/**
 * Client-side PREVIEW of the server's trade maths (server/src/domain/trade-calc.ts).
 * Uses JS numbers, so it's for live display only — the server recalculates with Decimals on save.
 */
import { DEFAULT_CONTRACT_SIZE } from "@/lib/constants";
import type { Direction, MarketType, RiskType, TradeResult } from "@/types/api";

const num = (v: string | null | undefined) => {
  if (v === null || v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface PreviewInput {
  direction: Direction;
  marketType: MarketType;
  entryPrice?: string;
  exitPrice?: string;
  quantity?: string;
  contractSize?: string;
  fees?: string;
  stopLoss?: string;
  takeProfit?: string;
  riskType?: RiskType | "";
  riskValue?: string;
  balance?: number;
}

export interface Preview {
  grossPnl: number | null;
  netPnl: number | null;
  result: TradeResult | null;
  riskReward: number | null;
  riskAmount: number | null;
  /** realised R multiple = net P&L / risk */
  rMultiple: number | null;
}

export function previewTrade(p: PreviewInput): Preview {
  const entry = num(p.entryPrice);
  const exit = num(p.exitPrice);
  const qty = num(p.quantity);
  const cs = num(p.contractSize) ?? DEFAULT_CONTRACT_SIZE[p.marketType];
  const fees = num(p.fees) ?? 0;
  const sl = num(p.stopLoss);
  const tp = num(p.takeProfit);
  const riskValue = num(p.riskValue);

  let grossPnl: number | null = null;
  let netPnl: number | null = null;
  if (entry !== null && exit !== null && qty !== null) {
    const move = exit - entry;
    grossPnl = (p.direction === "LONG" ? move : -move) * qty * cs;
    netPnl = grossPnl - fees;
  }

  let riskReward: number | null = null;
  if (entry !== null && sl !== null && tp !== null) {
    const risk = p.direction === "LONG" ? entry - sl : sl - entry;
    const reward = p.direction === "LONG" ? tp - entry : entry - tp;
    if (risk > 0 && reward > 0) riskReward = reward / risk;
  }

  let riskAmount: number | null = null;
  if (p.riskType && riskValue !== null) {
    riskAmount = p.riskType === "AMOUNT" ? riskValue : ((p.balance ?? 0) * riskValue) / 100;
  } else if (entry !== null && sl !== null && qty !== null) {
    const r = Math.abs(entry - sl) * qty * cs;
    riskAmount = r > 0 ? r : null;
  }

  const result: TradeResult | null =
    netPnl === null ? null : netPnl > 0 ? "PROFIT" : netPnl < 0 ? "LOSS" : "BREAKEVEN";
  const rMultiple = netPnl !== null && riskAmount ? netPnl / riskAmount : null;

  return { grossPnl, netPnl, result, riskReward, riskAmount, rMultiple };
}

export function formatRR(rr: string | number | null | undefined) {
  if (rr === null || rr === undefined) return "—";
  const n = Number(rr);
  return Number.isFinite(n) ? `1:${n.toFixed(2)}` : "—";
}

/** Plain decimal formatting for prices/quantities (no currency, keep meaningful decimals). */
export function formatNumber(v: string | number | null | undefined, maxDecimals = 8) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDecimals }).format(n);
}
