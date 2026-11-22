import { Prisma, TradeResult, TradeStatus, TransactionType } from "@prisma/client";
import { computeAccountStats, type AccountStats } from "../../domain/account-stats";
import { prisma } from "../../lib/prisma";
import { toDecimal, ZERO } from "../../utils/money";

interface Aggregates {
  deposits: Prisma.Decimal;
  withdrawals: Prisma.Decimal;
  closedNetPnl: Prisma.Decimal;
  wins: number;
  losses: number;
  breakevens: number;
}

const emptyAggregates = (): Aggregates => ({
  deposits: ZERO,
  withdrawals: ZERO,
  closedNetPnl: ZERO,
  wins: 0,
  losses: 0,
  breakevens: 0,
});

/**
 * Loads transaction + closed-trade aggregates for many accounts in 3 grouped queries
 * (no N+1), then runs the pure stats calculation for each account.
 */
export async function getStatsForAccounts(
  userId: string,
  accounts: { id: string; initialBalance: Prisma.Decimal }[],
): Promise<Map<string, AccountStats>> {
  const ids = accounts.map((a) => a.id);
  const result = new Map<string, AccountStats>();
  if (ids.length === 0) return result;

  const [txGroups, pnlGroups, resultGroups] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      where: { userId, accountId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.trade.groupBy({
      by: ["accountId"],
      where: { userId, accountId: { in: ids }, status: TradeStatus.CLOSED },
      _sum: { netPnl: true },
    }),
    prisma.trade.groupBy({
      by: ["accountId", "result"],
      where: { userId, accountId: { in: ids }, status: TradeStatus.CLOSED },
      _count: { _all: true },
    }),
  ]);

  const agg = new Map<string, Aggregates>(ids.map((id) => [id, emptyAggregates()]));

  for (const g of txGroups) {
    const a = agg.get(g.accountId);
    if (!a) continue;
    if (g.type === TransactionType.DEPOSIT) a.deposits = toDecimal(g._sum.amount);
    else a.withdrawals = toDecimal(g._sum.amount);
  }
  for (const g of pnlGroups) {
    const a = agg.get(g.accountId);
    if (a) a.closedNetPnl = toDecimal(g._sum.netPnl);
  }
  for (const g of resultGroups) {
    const a = agg.get(g.accountId);
    if (!a) continue;
    if (g.result === TradeResult.PROFIT) a.wins = g._count._all;
    else if (g.result === TradeResult.LOSS) a.losses = g._count._all;
    else if (g.result === TradeResult.BREAKEVEN) a.breakevens = g._count._all;
  }

  for (const account of accounts) {
    const a = agg.get(account.id) ?? emptyAggregates();
    result.set(
      account.id,
      computeAccountStats({
        initialBalance: account.initialBalance,
        totalDeposits: a.deposits,
        totalWithdrawals: a.withdrawals,
        closedNetPnl: a.closedNetPnl,
        wins: a.wins,
        losses: a.losses,
        breakevens: a.breakevens,
      }),
    );
  }
  return result;
}

export async function getStatsForAccount(userId: string, account: { id: string; initialBalance: Prisma.Decimal }) {
  const map = await getStatsForAccounts(userId, [account]);
  return map.get(account.id)!;
}
