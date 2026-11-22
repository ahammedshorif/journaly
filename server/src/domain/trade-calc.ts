import { Prisma } from "@prisma/client";

type Dec = Prisma.Decimal;
type DecLike = Dec | string | number;
const D = (v: DecLike) => new Prisma.Decimal(v);

export type Direction = "LONG" | "SHORT";
export type Market = "SPOT" | "FUTURES" | "FOREX" | "GOLD" | "OTHER";
export type Result = "PROFIT" | "LOSS" | "BREAKEVEN";
export type RiskKind = "AMOUNT" | "PERCENT";

/**
 * Units per 1 quantity. Quantity is coin/share amount for spot & futures, lots for Forex/Gold.
 * Forex: 1 standard lot = 100,000 units of base currency; Gold (XAU): 1 lot = 100 oz.
 * P&L comes out in the quote currency (accurate for USD-quoted pairs like EURUSD / XAUUSD / BTCUSDT).
 */
export const DEFAULT_CONTRACT_SIZE: Record<Market, string> = {
  SPOT: "1",
  FUTURES: "1",
  FOREX: "100000",
  GOLD: "100",
  OTHER: "1",
};

export function resolveContractSize(market: Market, contractSize?: DecLike | null): Dec {
  return contractSize !== null && contractSize !== undefined ? D(contractSize) : D(DEFAULT_CONTRACT_SIZE[market]);
}

/** (exit − entry) × qty × contractSize, sign flipped for shorts. Leverage does not change P&L for a given size. */
export function calcGrossPnl(p: {
  direction: Direction;
  entryPrice: DecLike;
  exitPrice: DecLike;
  quantity: DecLike;
  contractSize: DecLike;
}): Dec {
  const move = D(p.exitPrice).minus(p.entryPrice);
  const signed = p.direction === "LONG" ? move : move.neg();
  return signed.times(p.quantity).times(p.contractSize);
}

export function calcNetPnl(gross: DecLike, fees: DecLike): Dec {
  return D(gross).minus(fees);
}

export function deriveResult(netPnl: DecLike): Result {
  const n = D(netPnl);
  if (n.gt(0)) return "PROFIT";
  if (n.lt(0)) return "LOSS";
  return "BREAKEVEN";
}

/**
 * Planned reward:risk from entry, stop and target.
 * Returns null when either side is missing or on the wrong side of entry (e.g. a trailing stop in profit).
 */
export function calcRiskReward(p: {
  direction: Direction;
  entryPrice: DecLike;
  stopLoss?: DecLike | null;
  takeProfit?: DecLike | null;
}): Dec | null {
  if (p.stopLoss == null || p.takeProfit == null) return null;
  const entry = D(p.entryPrice);
  const risk = p.direction === "LONG" ? entry.minus(p.stopLoss) : D(p.stopLoss).minus(entry);
  const reward = p.direction === "LONG" ? D(p.takeProfit).minus(entry) : entry.minus(p.takeProfit);
  if (risk.lte(0) || reward.lte(0)) return null;
  return reward.div(risk).toDecimalPlaces(4);
}

/**
 * Risk in account currency:
 * - explicit $ amount, or % of the balance at entry
 * - otherwise derived from the stop distance: |entry − SL| × qty × contractSize
 */
export function calcRiskAmount(p: {
  riskType?: RiskKind | null;
  riskValue?: DecLike | null;
  balanceAtEntry: DecLike;
  entryPrice: DecLike;
  stopLoss?: DecLike | null;
  quantity: DecLike;
  contractSize: DecLike;
}): Dec | null {
  if (p.riskType && p.riskValue != null) {
    if (p.riskType === "AMOUNT") return D(p.riskValue);
    return D(p.balanceAtEntry).times(p.riskValue).div(100).toDecimalPlaces(8);
  }
  if (p.stopLoss != null) {
    const dist = D(p.entryPrice).minus(p.stopLoss).abs();
    const amount = dist.times(p.quantity).times(p.contractSize);
    return amount.gt(0) ? amount : null;
  }
  return null;
}

export interface TradeFinancialsInput {
  status: "OPEN" | "CLOSED";
  direction: Direction;
  marketType: Market;
  entryPrice: DecLike;
  exitPrice?: DecLike | null;
  quantity: DecLike;
  contractSize?: DecLike | null;
  fees: DecLike;
  stopLoss?: DecLike | null;
  takeProfit?: DecLike | null;
  riskType?: RiskKind | null;
  riskValue?: DecLike | null;
  /** user's manual net P&L — overrides the calculation when set */
  manualNetPnl?: DecLike | null;
  /** user's explicit result — derived from net P&L when null */
  result?: Result | null;
  balanceAtEntry: DecLike;
}

export interface TradeFinancials {
  grossPnl: Dec | null;
  netPnl: Dec | null;
  pnlOverridden: boolean;
  result: Result | null;
  resultOverridden: boolean;
  riskAmount: Dec | null;
  riskReward: Dec | null;
}

/** Single entry point used by the trade service on create/update. */
export function computeTradeFinancials(t: TradeFinancialsInput): TradeFinancials {
  const contractSize = resolveContractSize(t.marketType, t.contractSize);

  const riskReward = calcRiskReward(t);
  const riskAmount = calcRiskAmount({ ...t, contractSize });

  if (t.status === "OPEN") {
    return { grossPnl: null, netPnl: null, pnlOverridden: false, result: null, resultOverridden: false, riskAmount, riskReward };
  }

  let grossPnl: Dec | null = null;
  let netPnl: Dec | null = null;
  let pnlOverridden = false;

  if (t.manualNetPnl != null) {
    netPnl = D(t.manualNetPnl);
    grossPnl = netPnl.plus(t.fees);
    pnlOverridden = true;
  } else if (t.exitPrice != null) {
    grossPnl = calcGrossPnl({ ...t, exitPrice: t.exitPrice, contractSize });
    netPnl = calcNetPnl(grossPnl, t.fees);
  }

  const resultOverridden = t.result != null;
  const result = t.result ?? (netPnl ? deriveResult(netPnl) : null);
  return { grossPnl, netPnl, pnlOverridden, result, resultOverridden, riskAmount, riskReward };
}
