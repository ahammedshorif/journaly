import { Prisma } from "@prisma/client";

type Dec = Prisma.Decimal;
const D = (v: Dec | string | number) => new Prisma.Decimal(v);

export interface TimelineTransaction {
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: Dec | string;
  occurredAt: Date;
}

export interface TimelineTrade {
  id: string;
  closedAt: Date;
  createdAt: Date;
  netPnl: Dec | string;
}

/** Deterministic close order: closedAt, then createdAt, then id. */
function sortTrades<T extends TimelineTrade>(trades: T[]): T[] {
  return [...trades].sort(
    (a, b) =>
      a.closedAt.getTime() - b.closedAt.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}

const signed = (t: TimelineTransaction) => (t.type === "DEPOSIT" ? D(t.amount) : D(t.amount).neg());

/**
 * Balance after each closed trade, for the equity curve:
 * initial + all deposits/withdrawals up to (and including) the close time + cumulative net P&L.
 * A transaction at exactly the close time counts before the trade.
 */
export function computeBalanceTimeline(
  initialBalance: Dec | string,
  transactions: TimelineTransaction[],
  closedTrades: TimelineTrade[],
): { tradeId: string; balanceAfter: Dec }[] {
  const txs = [...transactions].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const out: { tradeId: string; balanceAfter: Dec }[] = [];

  let balance = D(initialBalance);
  let txIndex = 0;

  for (const trade of sortTrades(closedTrades)) {
    while (txIndex < txs.length && txs[txIndex]!.occurredAt.getTime() <= trade.closedAt.getTime()) {
      balance = balance.plus(signed(txs[txIndex]!));
      txIndex++;
    }
    balance = balance.plus(trade.netPnl);
    out.push({ tradeId: trade.id, balanceAfter: balance });
  }
  return out;
}

/** Account balance at a moment in time (used for "risk % of balance at entry"). */
export function balanceAt(
  at: Date,
  initialBalance: Dec | string,
  transactions: TimelineTransaction[],
  closedTrades: Pick<TimelineTrade, "closedAt" | "netPnl">[],
): Dec {
  let balance = D(initialBalance);
  for (const t of transactions) if (t.occurredAt.getTime() <= at.getTime()) balance = balance.plus(signed(t));
  for (const t of closedTrades) if (t.closedAt.getTime() <= at.getTime()) balance = balance.plus(t.netPnl);
  return balance;
}
