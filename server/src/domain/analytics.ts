import { Prisma } from "@prisma/client";
import { balanceAt, computeBalanceTimeline, type TimelineTransaction } from "./balance-timeline";
import { periodKey, WEEKDAY_LABELS, zonedParts, type Period } from "./time";

type Dec = Prisma.Decimal;
const D = (v: Dec | string | number) => new Prisma.Decimal(v);
const ZERO = D(0);
const money = (d: Dec) => d.toFixed(2);
const ratio = (n: number | null, dp = 2) => (n === null || !Number.isFinite(n) ? null : n.toFixed(dp));

/** Minimal closed-trade shape used by all analytics. */
export interface ClosedTrade {
  id: string;
  accountId: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  result: "PROFIT" | "LOSS" | "BREAKEVEN" | null;
  netPnl: Dec | string;
  fees: Dec | string;
  riskAmount: Dec | string | null;
  riskReward: Dec | string | null;
  strategy: string | null;
  emotionBefore: string | null;
  emotionAfter: string | null;
  openedAt: Date;
  closedAt: Date;
  createdAt: Date;
}

export function sortByClose<T extends Pick<ClosedTrade, "closedAt" | "createdAt" | "id">>(trades: T[]): T[] {
  return [...trades].sort(
    (a, b) => a.closedAt.getTime() - b.closedAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
}

// ───────────────────────────── Metrics ─────────────────────────────

export interface Metrics {
  netPnl: string;
  grossProfit: string;
  grossLoss: string;
  totalFees: string;
  roiPercent: string | null;
  winRate: string | null;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  avgWin: string | null;
  avgLoss: string | null;
  largestWin: string | null;
  largestLoss: string | null;
  profitFactor: string | null;
  expectancy: string | null;
  avgRiskReward: string | null;
  avgRMultiple: string | null;
  maxDrawdown: string;
  maxDrawdownPercent: string | null;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface MetricsOptions {
  /** Balance at the start of the period (for ROI and drawdown %). */
  startBalance: Dec | string;
  /** Deposits − withdrawals made during the period (added to ROI denominator). */
  netDeposits?: Dec | string;
}

/**
 * Win/loss counting follows each trade's `result` (respecting manual overrides), same as account stats.
 * - profit factor = gross profit ÷ |gross loss|
 * - expectancy = net P&L ÷ trades (average $ per trade)
 * - max drawdown = largest peak-to-trough fall of (start balance + cumulative net P&L), so deposits don't mask losses
 */
export function computeMetrics(tradesUnsorted: ClosedTrade[], opts: MetricsOptions): Metrics {
  const trades = sortByClose(tradesUnsorted);
  let net = ZERO;
  let grossProfit = ZERO;
  let grossLoss = ZERO;
  let fees = ZERO;
  let winSum = ZERO;
  let lossSum = ZERO;
  let largestWin: Dec | null = null;
  let largestLoss: Dec | null = null;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let rrSum = 0;
  let rrCount = 0;
  let rSum = 0;
  let rCount = 0;

  let curWin = 0;
  let curLoss = 0;
  let longestWin = 0;
  let longestLoss = 0;

  const start = D(opts.startBalance);
  let equity = start;
  let peak = start;
  let maxDd = ZERO;
  let maxDdPct: number | null = null;

  for (const t of trades) {
    const pnl = D(t.netPnl);
    net = net.plus(pnl);
    fees = fees.plus(t.fees);
    if (pnl.gt(0)) grossProfit = grossProfit.plus(pnl);
    if (pnl.lt(0)) grossLoss = grossLoss.plus(pnl.abs());

    if (t.result === "PROFIT") {
      wins++;
      winSum = winSum.plus(pnl);
      if (!largestWin || pnl.gt(largestWin)) largestWin = pnl;
      curWin++;
      curLoss = 0;
    } else if (t.result === "LOSS") {
      losses++;
      lossSum = lossSum.plus(pnl);
      if (!largestLoss || pnl.lt(largestLoss)) largestLoss = pnl;
      curLoss++;
      curWin = 0;
    } else {
      breakevens++;
      curWin = 0;
      curLoss = 0;
    }
    longestWin = Math.max(longestWin, curWin);
    longestLoss = Math.max(longestLoss, curLoss);

    if (t.riskReward !== null) {
      rrSum += Number(t.riskReward);
      rrCount++;
    }
    if (t.riskAmount !== null && D(t.riskAmount).gt(0)) {
      rSum += pnl.div(t.riskAmount).toNumber();
      rCount++;
    }

    equity = equity.plus(pnl);
    if (equity.gt(peak)) peak = equity;
    const dd = peak.minus(equity);
    if (dd.gt(maxDd)) {
      maxDd = dd;
      maxDdPct = peak.gt(0) ? dd.div(peak).times(100).toNumber() : null;
    }
  }

  const total = trades.length;
  const invested = start.plus(opts.netDeposits ?? 0);
  const decided = wins + losses;

  return {
    netPnl: money(net),
    grossProfit: money(grossProfit),
    grossLoss: money(grossLoss),
    totalFees: money(fees),
    roiPercent: invested.gt(0) ? net.div(invested).times(100).toFixed(2) : null,
    winRate: decided ? ratio((wins / decided) * 100) : null,
    totalTrades: total,
    wins,
    losses,
    breakevens,
    avgWin: wins ? money(winSum.div(wins)) : null,
    avgLoss: losses ? money(lossSum.div(losses)) : null,
    largestWin: largestWin ? money(largestWin) : null,
    largestLoss: largestLoss ? money(largestLoss) : null,
    profitFactor: grossLoss.gt(0) ? grossProfit.div(grossLoss).toFixed(2) : null,
    expectancy: total ? money(net.div(total)) : null,
    avgRiskReward: rrCount ? ratio(rrSum / rrCount) : null,
    avgRMultiple: rCount ? ratio(rSum / rCount) : null,
    maxDrawdown: money(maxDd),
    maxDrawdownPercent: ratio(maxDdPct),
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
  };
}

// ───────────────────────────── Grouping ─────────────────────────────

export interface Bucket {
  key: string;
  label: string;
  netPnl: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: string | null;
  avgPnl: string;
}

function bucketize(trades: ClosedTrade[], keyOf: (t: ClosedTrade) => string | null, labelOf: (k: string) => string = (k) => k) {
  const map = new Map<string, { net: Dec; trades: number; wins: number; losses: number }>();
  for (const t of trades) {
    const k = keyOf(t);
    if (k === null) continue;
    const b = map.get(k) ?? { net: ZERO, trades: 0, wins: 0, losses: 0 };
    b.net = b.net.plus(t.netPnl);
    b.trades++;
    if (t.result === "PROFIT") b.wins++;
    if (t.result === "LOSS") b.losses++;
    map.set(k, b);
  }
  return [...map.entries()].map(
    ([key, b]): Bucket => ({
      key,
      label: labelOf(key),
      netPnl: money(b.net),
      trades: b.trades,
      wins: b.wins,
      losses: b.losses,
      winRate: b.wins + b.losses ? ratio((b.wins / (b.wins + b.losses)) * 100) : null,
      avgPnl: money(b.net.div(b.trades)),
    }),
  );
}

const byNetDesc = (a: Bucket, b: Bucket) => Number(b.netPnl) - Number(a.netPnl);

export function breakdownByPeriod(trades: ClosedTrade[], period: Period, tz: string) {
  return bucketize(trades, (t) => periodKey(t.closedAt, tz, period)).sort((a, b) => a.key.localeCompare(b.key));
}

export function breakdownByPair(trades: ClosedTrade[]) {
  return bucketize(trades, (t) => t.symbol).sort(byNetDesc);
}

export function breakdownByStrategy(trades: ClosedTrade[]) {
  return bucketize(trades, (t) => t.strategy?.trim() || "No strategy").sort(byNetDesc);
}

/** Mon..Sun, always 7 rows (by close day in the user's timezone). */
export function breakdownByWeekday(trades: ClosedTrade[], tz: string) {
  const got = new Map(bucketize(trades, (t) => String(zonedParts(t.closedAt, tz).weekday)).map((b) => [b.key, b]));
  return WEEKDAY_LABELS.map((label, i) => ({ ...(got.get(String(i)) ?? emptyBucket(String(i))), label }));
}

/** 0..23 by ENTRY hour — when you click "buy" is what you can change. */
export function breakdownByHour(trades: ClosedTrade[], tz: string) {
  const got = new Map(bucketize(trades, (t) => String(zonedParts(t.openedAt, tz).hour)).map((b) => [b.key, b]));
  return Array.from({ length: 24 }, (_, h) => ({
    ...(got.get(String(h)) ?? emptyBucket(String(h))),
    label: `${String(h).padStart(2, "0")}:00`,
  }));
}

/** Per emotion, sorted so the most expensive emotions come first. */
export function breakdownByEmotion(trades: ClosedTrade[], which: "before" | "after") {
  return bucketize(trades, (t) => (which === "before" ? t.emotionBefore : t.emotionAfter)).sort(
    (a, b) => Number(a.netPnl) - Number(b.netPnl),
  );
}

export function breakdownByDirection(trades: ClosedTrade[]) {
  return bucketize(trades, (t) => t.direction).sort((a, b) => a.key.localeCompare(b.key));
}

function emptyBucket(key: string): Bucket {
  return { key, label: key, netPnl: "0.00", trades: 0, wins: 0, losses: 0, winRate: null, avgPnl: "0.00" };
}

// ───────────────────────────── Equity curve ─────────────────────────────

export interface EquityPoint {
  time: string;
  balance: string;
  /** cumulative net P&L since the start of the curve */
  cumulativePnl: string;
  tradeId: string | null;
}

/**
 * Combined equity curve over one or many accounts: Σ initial balances + all cash flows + closed trades in close order.
 * Starts with a point at `from` (or just before the first trade) so the line has a baseline.
 */
export function computeEquityCurve(
  initialBalance: Dec | string,
  transactions: TimelineTransaction[],
  trades: Pick<ClosedTrade, "id" | "closedAt" | "createdAt" | "netPnl">[],
  range: { from?: Date; to?: Date } = {},
): EquityPoint[] {
  const timeline = computeBalanceTimeline(initialBalance, transactions, trades);
  const byId = new Map(trades.map((t) => [t.id, t]));
  const from = range.from?.getTime() ?? -Infinity;
  const to = range.to?.getTime() ?? Infinity;

  const points: EquityPoint[] = [];
  let cum = ZERO;

  for (const p of timeline) {
    const t = byId.get(p.tradeId)!;
    const ts = t.closedAt.getTime();
    if (ts < from) continue;
    if (ts > to) break;
    if (points.length === 0) {
      // Baseline: balance at `from`, or just before the first trade when there's no range.
      const start = range.from
        ? balanceAt(range.from, initialBalance, transactions, trades)
        : p.balanceAfter.minus(t.netPnl);
      points.push({ time: new Date(range.from ? from : ts - 1).toISOString(), balance: money(start), cumulativePnl: "0.00", tradeId: null });
    }
    cum = cum.plus(t.netPnl);
    points.push({ time: t.closedAt.toISOString(), balance: money(p.balanceAfter), cumulativePnl: money(cum), tradeId: t.id });
  }
  return points;
}

/** Daily net P&L for the calendar heatmap (only days with trades; client fills the gaps). */
export function dailyPnl(trades: ClosedTrade[], tz: string) {
  return breakdownByPeriod(trades, "daily", tz).map((b) => ({ date: b.key, netPnl: b.netPnl, trades: b.trades }));
}
