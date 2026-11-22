import { Prisma } from "@prisma/client";

const D = (v: Prisma.Decimal | string | number) => new Prisma.Decimal(v);

export type GoalStatus = "on_track" | "achieved" | "ok" | "warning" | "breached";

export interface GoalProgress {
  /** P&L for the goal's window (month for profit goals, today for loss limits) */
  current: string;
  /** 0-100+ : share of the target reached, or share of the loss limit used */
  percent: number;
  status: GoalStatus;
  remaining: string;
}

/** Monthly profit target: how far this month's net P&L is toward the target. */
export function monthlyProfitProgress(target: Prisma.Decimal | string, monthPnl: Prisma.Decimal | string): GoalProgress {
  const t = D(target);
  const pnl = D(monthPnl);
  const pct = t.gt(0) ? Math.max(0, pnl.div(t).times(100).toNumber()) : 0;
  return {
    current: pnl.toFixed(2),
    percent: Math.round(pct * 10) / 10,
    status: pnl.gte(t) ? "achieved" : "on_track",
    remaining: Prisma.Decimal.max(0, t.minus(pnl)).toFixed(2),
  };
}

export const DAILY_LOSS_WARNING_AT = 75; // % of limit used

/** Max daily loss: how much of today's loss allowance is used. Profits use none of it. */
export function dailyLossProgress(limit: Prisma.Decimal | string, todayPnl: Prisma.Decimal | string): GoalProgress {
  const l = D(limit);
  const pnl = D(todayPnl);
  const loss = pnl.lt(0) ? pnl.abs() : D(0);
  const pct = l.gt(0) ? loss.div(l).times(100).toNumber() : 0;
  return {
    current: pnl.toFixed(2),
    percent: Math.round(pct * 10) / 10,
    status: pct >= 100 ? "breached" : pct >= DAILY_LOSS_WARNING_AT ? "warning" : "ok",
    remaining: Prisma.Decimal.max(0, l.minus(loss)).toFixed(2),
  };
}

/** Length of the current losing streak (most recent trades last). Breakevens end a streak. */
export function currentLossStreak(results: (string | null)[]): number {
  let n = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === "LOSS") n++;
    else break;
  }
  return n;
}
