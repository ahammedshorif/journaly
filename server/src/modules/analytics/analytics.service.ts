import { Prisma, TradeStatus } from "@prisma/client";
import {
  breakdownByDirection,
  breakdownByEmotion,
  breakdownByHour,
  breakdownByPair,
  breakdownByPeriod,
  breakdownByStrategy,
  breakdownByWeekday,
  computeEquityCurve,
  computeMetrics,
  dailyPnl,
  type ClosedTrade,
} from "../../domain/analytics";
import { balanceAt } from "../../domain/balance-timeline";
import { isValidTimeZone, startOfDay, startOfMonth, startOfWeek } from "../../domain/time";
import { prisma } from "../../lib/prisma";
import { toDecimal, ZERO } from "../../utils/money";
import { getStatsForAccounts } from "../accounts/account-stats.service";
import { findOwnedAccount } from "../accounts/accounts.service";
import type { BreakdownQuery, RangeQuery, ScopeQuery } from "./analytics.schema";

const closedTradeSelect = {
  id: true,
  accountId: true,
  symbol: true,
  direction: true,
  result: true,
  netPnl: true,
  fees: true,
  riskAmount: true,
  riskReward: true,
  strategy: true,
  emotionBefore: true,
  emotionAfter: true,
  openedAt: true,
  closedAt: true,
  createdAt: true,
} satisfies Prisma.TradeSelect;

/**
 * Accounts in scope: one account (if accountId, archived or not), otherwise every ACTIVE account.
 * Also resolves the user's timezone and whether currencies can be summed.
 */
export async function resolveScope(userId: string, accountId?: string) {
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, currency: true } }),
    accountId
      ? findOwnedAccount(userId, accountId).then((a) => [a])
      : prisma.journalAccount.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } }),
  ]);
  const tz = user?.timezone && isValidTimeZone(user.timezone) ? user.timezone : "UTC";
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  return {
    tz,
    accounts,
    accountIds: accounts.map((a) => a.id),
    currency: currencies.length === 1 ? currencies[0]! : currencies.length === 0 ? (user?.currency ?? "USD") : null,
    mixedCurrencies: currencies.length > 1,
  };
}

export async function loadClosedTrades(userId: string, accountIds: string[], range: { from?: Date; to?: Date } = {}) {
  if (accountIds.length === 0) return [] as ClosedTrade[];
  const rows = await prisma.trade.findMany({
    where: {
      userId,
      accountId: { in: accountIds },
      status: TradeStatus.CLOSED,
      netPnl: { not: null },
      closedAt: { not: null, ...(range.from && { gte: range.from }), ...(range.to && { lte: range.to }) },
    },
    select: closedTradeSelect,
    orderBy: [{ closedAt: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({ ...r, netPnl: r.netPnl!, closedAt: r.closedAt! })) as ClosedTrade[];
}

async function loadTransactions(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) return [];
  return prisma.transaction.findMany({
    where: { userId, accountId: { in: accountIds } },
    select: { type: true, amount: true, occurredAt: true },
  });
}

const sumInitial = (accounts: { initialBalance: Prisma.Decimal }[]) =>
  accounts.reduce((s, a) => s.plus(a.initialBalance), new Prisma.Decimal(0));

/** Everything the analytics page needs for a range, computed from one load. */
async function buildReport(userId: string, q: BreakdownQuery) {
  const scope = await resolveScope(userId, q.accountId);
  const [allTrades, txs] = await Promise.all([loadClosedTrades(userId, scope.accountIds), loadTransactions(userId, scope.accountIds)]);
  const from = q.from?.getTime() ?? -Infinity;
  const to = q.to?.getTime() ?? Infinity;
  const trades = allTrades.filter((t) => t.closedAt.getTime() >= from && t.closedAt.getTime() <= to);

  const initial = sumInitial(scope.accounts);
  const startBalance = q.from ? balanceAt(q.from, initial, txs, allTrades) : initial;
  const netDeposits = txs
    .filter((t) => t.occurredAt.getTime() > (q.from ? from : -Infinity) && t.occurredAt.getTime() <= to)
    .reduce((s, t) => (t.type === "DEPOSIT" ? s.plus(t.amount) : s.minus(t.amount)), new Prisma.Decimal(0));

  return {
    scope,
    trades,
    report: {
      currency: scope.currency,
      mixedCurrencies: scope.mixedCurrencies,
      timezone: scope.tz,
      period: q.period,
      range: { from: q.from ?? null, to: q.to ?? null },
      startBalance: startBalance.toFixed(2),
      metrics: computeMetrics(trades, { startBalance, netDeposits }),
      periods: breakdownByPeriod(trades, q.period, scope.tz),
      byPair: breakdownByPair(trades),
      byStrategy: breakdownByStrategy(trades),
      byWeekday: breakdownByWeekday(trades, scope.tz),
      byHour: breakdownByHour(trades, scope.tz),
      byDirection: breakdownByDirection(trades),
      emotions: { before: breakdownByEmotion(trades, "before"), after: breakdownByEmotion(trades, "after") },
      calendar: dailyPnl(trades, scope.tz),
      equityCurve: computeEquityCurve(initial, txs, allTrades, { from: q.from, to: q.to }),
    },
  };
}

export const analyticsService = {
  /** Dashboard numbers. */
  async summary(userId: string, q: ScopeQuery) {
    const scope = await resolveScope(userId, q.accountId);
    const now = new Date();
    const dayStart = startOfDay(now, scope.tz);
    const weekStart = startOfWeek(now, scope.tz);
    const monthStart = startOfMonth(now, scope.tz);
    const earliest = new Date(Math.min(weekStart.getTime(), monthStart.getTime()));

    const [stats, recent, openTrades] = await Promise.all([
      getStatsForAccounts(userId, scope.accounts),
      loadClosedTrades(userId, scope.accountIds, { from: earliest }),
      scope.accountIds.length
        ? prisma.trade.count({ where: { userId, accountId: { in: scope.accountIds }, status: TradeStatus.OPEN } })
        : 0,
    ]);

    const sumSince = (since: Date) =>
      recent.filter((t) => t.closedAt >= since).reduce((s, t) => s.plus(t.netPnl), ZERO).toFixed(2);

    const byCurrency = new Map<string, { balance: Prisma.Decimal; totalPnl: Prisma.Decimal; accounts: number }>();
    let wins = 0;
    let losses = 0;
    let closed = 0;
    for (const a of scope.accounts) {
      const s = stats.get(a.id)!;
      const c = byCurrency.get(a.currency) ?? { balance: ZERO, totalPnl: ZERO, accounts: 0 };
      c.balance = c.balance.plus(s.currentBalance);
      c.totalPnl = c.totalPnl.plus(s.totalPnl);
      c.accounts++;
      byCurrency.set(a.currency, c);
      wins += s.wins;
      losses += s.losses;
      closed += s.closedTrades;
    }
    const balances = [...byCurrency.entries()].map(([currency, c]) => ({
      currency,
      balance: c.balance.toFixed(2),
      totalPnl: c.totalPnl.toFixed(2),
      accounts: c.accounts,
    }));

    return {
      currency: scope.currency,
      mixedCurrencies: scope.mixedCurrencies,
      timezone: scope.tz,
      accounts: scope.accounts.length,
      totalBalance: scope.mixedCurrencies ? null : (balances[0]?.balance ?? "0.00"),
      totalPnl: scope.mixedCurrencies ? null : (balances[0]?.totalPnl ?? "0.00"),
      balances,
      pnl: { today: sumSince(dayStart), week: sumSince(weekStart), month: sumSince(monthStart) },
      winRate: wins + losses ? ((wins / (wins + losses)) * 100).toFixed(2) : null,
      wins,
      losses,
      closedTrades: closed,
      openTrades,
    };
  },

  async equityCurve(userId: string, q: RangeQuery) {
    const scope = await resolveScope(userId, q.accountId);
    const [trades, txs] = await Promise.all([loadClosedTrades(userId, scope.accountIds), loadTransactions(userId, scope.accountIds)]);
    return {
      currency: scope.currency,
      mixedCurrencies: scope.mixedCurrencies,
      points: computeEquityCurve(sumInitial(scope.accounts), txs, trades, { from: q.from, to: q.to }),
    };
  },

  async breakdown(userId: string, q: BreakdownQuery) {
    return (await buildReport(userId, q)).report;
  },

  /** Exposed for the export module (needs the filtered trades too). */
  buildReport,

  /** Side-by-side metrics for every account (archived included, flagged). */
  async compare(userId: string, q: RangeQuery) {
    const accounts = await prisma.journalAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    const ids = accounts.map((a) => a.id);
    const [allTrades, txs, stats] = await Promise.all([
      loadClosedTrades(userId, ids),
      prisma.transaction.findMany({ where: { userId }, select: { accountId: true, type: true, amount: true, occurredAt: true } }),
      getStatsForAccounts(userId, accounts),
    ]);
    const from = q.from?.getTime() ?? -Infinity;
    const to = q.to?.getTime() ?? Infinity;

    return accounts.map((a) => {
      const accTrades = allTrades.filter((t) => t.accountId === a.id);
      const accTxs = txs.filter((t) => t.accountId === a.id);
      const inRange = accTrades.filter((t) => t.closedAt.getTime() >= from && t.closedAt.getTime() <= to);
      const startBalance = q.from ? balanceAt(q.from, a.initialBalance, accTxs, accTrades) : a.initialBalance;
      const netDeposits = accTxs
        .filter((t) => t.occurredAt.getTime() > (q.from ? from : -Infinity) && t.occurredAt.getTime() <= to)
        .reduce((s, t) => (t.type === "DEPOSIT" ? s.plus(t.amount) : s.minus(t.amount)), toDecimal(0));
      return {
        accountId: a.id,
        name: a.name,
        platform: a.platform,
        currency: a.currency,
        isArchived: a.isArchived,
        currentBalance: stats.get(a.id)!.currentBalance,
        metrics: computeMetrics(inRange, { startBalance, netDeposits }),
      };
    });
  },
};
