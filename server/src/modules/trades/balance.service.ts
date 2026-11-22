import { Prisma, TradeStatus } from "@prisma/client";
import { balanceAt, computeBalanceTimeline } from "../../domain/balance-timeline";

type Tx = Prisma.TransactionClient;

/** Serialises concurrent writes to the same account (trade/transaction changes + recompute). */
export async function lockAccount(tx: Tx, accountId: string) {
  await tx.$queryRaw`SELECT id FROM "JournalAccount" WHERE id = ${accountId}::uuid FOR UPDATE`;
}

async function loadLedger(tx: Tx, accountId: string, excludeTradeId?: string) {
  const [account, transactions, closedTrades] = await Promise.all([
    tx.journalAccount.findUniqueOrThrow({ where: { id: accountId }, select: { initialBalance: true } }),
    tx.transaction.findMany({ where: { accountId }, select: { type: true, amount: true, occurredAt: true } }),
    tx.trade.findMany({
      where: {
        accountId,
        status: TradeStatus.CLOSED,
        closedAt: { not: null },
        netPnl: { not: null },
        ...(excludeTradeId ? { id: { not: excludeTradeId } } : {}),
      },
      select: { id: true, closedAt: true, createdAt: true, netPnl: true },
    }),
  ]);
  return {
    initialBalance: account.initialBalance,
    transactions,
    closedTrades: closedTrades.map((t) => ({ id: t.id, closedAt: t.closedAt!, createdAt: t.createdAt, netPnl: t.netPnl! })),
  };
}

/** Balance at `at`, ignoring the trade being edited (so its own P&L doesn't count toward its risk %). */
export async function getBalanceAt(tx: Tx, accountId: string, at: Date, excludeTradeId?: string) {
  const ledger = await loadLedger(tx, accountId, excludeTradeId);
  return balanceAt(at, ledger.initialBalance, ledger.transactions, ledger.closedTrades);
}

/**
 * Rewrites `balanceAfter` for every closed trade of the account (equity curve).
 * Called inside the same DB transaction as any trade / transaction / initial-balance change.
 */
export async function recomputeAccountBalances(tx: Tx, accountId: string) {
  const ledger = await loadLedger(tx, accountId);
  const timeline = computeBalanceTimeline(ledger.initialBalance, ledger.transactions, ledger.closedTrades);

  if (timeline.length > 0) {
    const ids = timeline.map((t) => t.tradeId);
    const balances = timeline.map((t) => t.balanceAfter.toString());
    await tx.$executeRaw`
      UPDATE "Trade" AS t
      SET "balanceAfter" = v.b::numeric
      FROM unnest(${ids}::uuid[], ${balances}::text[]) AS v(id, b)
      WHERE t.id = v.id`;
  }

  // Open trades (or closed ones without P&L) have no point on the curve.
  await tx.trade.updateMany({
    where: { accountId, balanceAfter: { not: null }, OR: [{ status: TradeStatus.OPEN }, { netPnl: null }] },
    data: { balanceAfter: null },
  });
}
