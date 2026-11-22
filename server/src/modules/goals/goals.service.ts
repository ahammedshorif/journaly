import { GoalType, type Goal } from "@prisma/client";
import { currentLossStreak, dailyLossProgress, monthlyProfitProgress } from "../../domain/goals";
import { startOfDay, startOfMonth } from "../../domain/time";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/http-error";
import { ZERO } from "../../utils/money";
import { findOwnedAccount } from "../accounts/accounts.service";
import { loadClosedTrades, resolveScope } from "../analytics/analytics.service";
import type { CreateGoalInput, UpdateGoalInput } from "./goals.schema";

export interface RiskWarning {
  level: "warning" | "danger";
  code: "DAILY_LOSS_LIMIT_BREACHED" | "DAILY_LOSS_LIMIT_NEAR" | "LOSS_STREAK";
  message: string;
  accountId: string | null;
}

async function progressFor(userId: string, goal: Goal) {
  const scope = await resolveScope(userId, goal.accountId ?? undefined);
  const now = new Date();
  const since = goal.type === GoalType.MONTHLY_PROFIT ? startOfMonth(now, scope.tz) : startOfDay(now, scope.tz);
  const trades = await loadClosedTrades(userId, scope.accountIds, { from: since });
  const pnl = trades.reduce((s, t) => s.plus(t.netPnl), ZERO);
  const progress = goal.type === GoalType.MONTHLY_PROFIT ? monthlyProfitProgress(goal.amount, pnl) : dailyLossProgress(goal.amount, pnl);
  return { scope, progress };
}

async function serialize(userId: string, goal: Goal) {
  const { scope, progress } = await progressFor(userId, goal);
  const account = goal.accountId ? scope.accounts[0] : null;
  return {
    id: goal.id,
    type: goal.type,
    amount: goal.amount.toFixed(2),
    accountId: goal.accountId,
    accountName: account?.name ?? null,
    currency: scope.currency,
    mixedCurrencies: scope.mixedCurrencies,
    isActive: goal.isActive,
    createdAt: goal.createdAt,
    progress,
  };
}

export const goalsService = {
  /** Active goals with live progress, plus risk warnings derived from them. */
  async list(userId: string) {
    const goals = await prisma.goal.findMany({
      where: { userId, isActive: true, OR: [{ accountId: null }, { account: { isArchived: false } }] },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });
    const items = await Promise.all(goals.map((g) => serialize(userId, g)));

    const warnings: RiskWarning[] = [];
    for (const g of items) {
      if (g.type !== GoalType.MAX_DAILY_LOSS) continue;
      const where = g.accountName ? ` on ${g.accountName}` : "";
      if (g.progress.status === "breached") {
        warnings.push({
          level: "danger",
          code: "DAILY_LOSS_LIMIT_BREACHED",
          message: `Daily loss limit exceeded${where}: you're down ${Math.abs(Number(g.progress.current)).toFixed(2)} of a ${g.amount} limit. Consider stopping for today.`,
          accountId: g.accountId,
        });
      } else if (g.progress.status === "warning") {
        warnings.push({
          level: "warning",
          code: "DAILY_LOSS_LIMIT_NEAR",
          message: `You've used ${g.progress.percent}% of your daily loss limit${where}. ${g.progress.remaining} left.`,
          accountId: g.accountId,
        });
      }
    }

    // Losing-streak nudge (independent of goals): last 3+ closed trades today were losses.
    const scope = await resolveScope(userId);
    const today = await loadClosedTrades(userId, scope.accountIds, { from: startOfDay(new Date(), scope.tz) });
    const streak = currentLossStreak(today.map((t) => t.result));
    if (streak >= 3) {
      warnings.push({
        level: "warning",
        code: "LOSS_STREAK",
        message: `${streak} losses in a row today. Step away before revenge trading.`,
        accountId: null,
      });
    }

    return { goals: items, warnings };
  },

  /** One active goal per (type, account): creating again updates the amount. */
  async upsert(userId: string, input: CreateGoalInput) {
    if (input.accountId) await findOwnedAccount(userId, input.accountId);
    const existing = await prisma.goal.findFirst({
      where: { userId, type: input.type, accountId: input.accountId, isActive: true },
    });
    const goal = existing
      ? await prisma.goal.update({ where: { id: existing.id }, data: { amount: input.amount } })
      : await prisma.goal.create({ data: { userId, ...input } });
    return serialize(userId, goal);
  },

  async update(userId: string, id: string, input: UpdateGoalInput) {
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw HttpError.notFound("Goal not found");
    return serialize(userId, await prisma.goal.update({ where: { id }, data: input }));
  },

  async remove(userId: string, id: string) {
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw HttpError.notFound("Goal not found");
    await prisma.goal.delete({ where: { id } });
  },
};
