import { Prisma } from "@prisma/client";

type Dec = Prisma.Decimal;
const D = (v: Dec | string | number) => new Prisma.Decimal(v);

export interface AccountStatsInput {
  initialBalance: Dec;
  totalDeposits: Dec;
  totalWithdrawals: Dec;
  /** Sum of net P&L of CLOSED trades only */
  closedNetPnl: Dec;
  wins: number;
  losses: number;
  breakevens: number;
}

export interface AccountStats {
  currentBalance: string;
  netDeposits: string;
  /** initial + deposits - withdrawals */
  investedCapital: string;
  totalPnl: string;
  /** P&L / invested capital × 100, null when invested capital ≤ 0 */
  roiPercent: string | null;
  /** wins / (wins + losses) × 100 — breakevens excluded; null when no decided trades */
  winRate: string | null;
  closedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
}

/**
 * Pure balance/stat calculation.
 * Balance = initial + deposits − withdrawals + Σ net P&L of closed trades.
 */
export function computeAccountStats(input: AccountStatsInput): AccountStats {
  const netDeposits = D(input.totalDeposits).minus(input.totalWithdrawals);
  const invested = D(input.initialBalance).plus(netDeposits);
  const balance = invested.plus(input.closedNetPnl);

  const roi = invested.gt(0) ? D(input.closedNetPnl).div(invested).times(100) : null;

  const decided = input.wins + input.losses;
  const winRate = decided > 0 ? D(input.wins).div(decided).times(100) : null;

  return {
    currentBalance: balance.toFixed(2),
    netDeposits: netDeposits.toFixed(2),
    investedCapital: invested.toFixed(2),
    totalPnl: D(input.closedNetPnl).toFixed(2),
    roiPercent: roi ? roi.toFixed(2) : null,
    winRate: winRate ? winRate.toFixed(2) : null,
    closedTrades: input.wins + input.losses + input.breakevens,
    wins: input.wins,
    losses: input.losses,
    breakevens: input.breakevens,
  };
}

/** Raw balance as a Decimal (used for validations, e.g. withdrawals). */
export function computeBalance(input: Pick<AccountStatsInput, "initialBalance" | "totalDeposits" | "totalWithdrawals" | "closedNetPnl">): Dec {
  return D(input.initialBalance).plus(input.totalDeposits).minus(input.totalWithdrawals).plus(input.closedNetPnl);
}
