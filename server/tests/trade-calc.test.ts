import { describe, expect, it } from "vitest";
import {
  calcGrossPnl,
  calcRiskAmount,
  calcRiskReward,
  computeTradeFinancials,
  deriveResult,
  resolveContractSize,
  type TradeFinancialsInput,
} from "../src/domain/trade-calc";

const s = (d: { toString(): string } | null) => (d === null ? null : d.toString());

describe("calcGrossPnl", () => {
  it("long in profit", () => {
    expect(s(calcGrossPnl({ direction: "LONG", entryPrice: "100", exitPrice: "110", quantity: "2", contractSize: "1" }))).toBe("20");
  });
  it("long in loss", () => {
    expect(s(calcGrossPnl({ direction: "LONG", entryPrice: "100", exitPrice: "95", quantity: "2", contractSize: "1" }))).toBe("-10");
  });
  it("short in profit when price falls", () => {
    expect(s(calcGrossPnl({ direction: "SHORT", entryPrice: "100", exitPrice: "90", quantity: "3", contractSize: "1" }))).toBe("30");
  });
  it("short in loss when price rises", () => {
    expect(s(calcGrossPnl({ direction: "SHORT", entryPrice: "100", exitPrice: "104", quantity: "1", contractSize: "1" }))).toBe("-4");
  });
  it("forex lots use the 100,000 contract size (EURUSD 0.5 lot, +20 pips = $100)", () => {
    const pnl = calcGrossPnl({
      direction: "LONG",
      entryPrice: "1.08500",
      exitPrice: "1.08700",
      quantity: "0.5",
      contractSize: resolveContractSize("FOREX"),
    });
    expect(s(pnl)).toBe("100");
  });
  it("gold lots use the 100 oz contract size (XAUUSD 0.1 lot, $5 move = $50)", () => {
    const pnl = calcGrossPnl({ direction: "SHORT", entryPrice: "2400", exitPrice: "2395", quantity: "0.1", contractSize: resolveContractSize("GOLD") });
    expect(s(pnl)).toBe("50");
  });
  it("custom contract size overrides the default", () => {
    expect(s(resolveContractSize("FOREX", "10000"))).toBe("10000");
  });
  it("keeps full precision for small crypto moves", () => {
    const pnl = calcGrossPnl({ direction: "LONG", entryPrice: "0.00001234", exitPrice: "0.00001334", quantity: "1000000", contractSize: "1" });
    expect(s(pnl)).toBe("1");
  });
});

describe("deriveResult", () => {
  it.each([
    ["10.5", "PROFIT"],
    ["-0.01", "LOSS"],
    ["0", "BREAKEVEN"],
  ])("%s → %s", (pnl, expected) => expect(deriveResult(pnl)).toBe(expected));
});

describe("calcRiskReward", () => {
  it("long 1:2", () => {
    expect(s(calcRiskReward({ direction: "LONG", entryPrice: "100", stopLoss: "95", takeProfit: "110" }))).toBe("2");
  });
  it("short 1:3", () => {
    expect(s(calcRiskReward({ direction: "SHORT", entryPrice: "100", stopLoss: "102", takeProfit: "94" }))).toBe("3");
  });
  it("rounds to 4 decimals", () => {
    expect(s(calcRiskReward({ direction: "LONG", entryPrice: "100", stopLoss: "97", takeProfit: "110" }))).toBe("3.3333");
  });
  it("null when SL is on the wrong side", () => {
    expect(calcRiskReward({ direction: "LONG", entryPrice: "100", stopLoss: "101", takeProfit: "110" })).toBeNull();
  });
  it("null when SL or TP missing", () => {
    expect(calcRiskReward({ direction: "LONG", entryPrice: "100", stopLoss: "95" })).toBeNull();
  });
});

describe("calcRiskAmount", () => {
  const base = { balanceAtEntry: "2000", entryPrice: "100", quantity: "4", contractSize: "1" };
  it("fixed amount", () => {
    expect(s(calcRiskAmount({ ...base, riskType: "AMOUNT", riskValue: "50" }))).toBe("50");
  });
  it("percent of balance at entry", () => {
    expect(s(calcRiskAmount({ ...base, riskType: "PERCENT", riskValue: "1.5" }))).toBe("30");
  });
  it("derived from stop distance when no explicit risk", () => {
    expect(s(calcRiskAmount({ ...base, stopLoss: "97.5" }))).toBe("10");
  });
  it("null with no risk info", () => {
    expect(calcRiskAmount(base)).toBeNull();
  });
});

describe("computeTradeFinancials", () => {
  const closed: TradeFinancialsInput = {
    status: "CLOSED",
    direction: "LONG",
    marketType: "FUTURES",
    entryPrice: "100",
    exitPrice: "110",
    quantity: "2",
    fees: "1.5",
    stopLoss: "95",
    takeProfit: "110",
    balanceAtEntry: "1000",
  };

  it("net = gross − fees and result is derived", () => {
    const f = computeTradeFinancials(closed);
    expect(s(f.grossPnl)).toBe("20");
    expect(s(f.netPnl)).toBe("18.5");
    expect(f.result).toBe("PROFIT");
    expect(f.pnlOverridden).toBe(false);
    expect(s(f.riskReward)).toBe("2");
    expect(s(f.riskAmount)).toBe("10");
  });

  it("fees can turn a tiny win into a loss", () => {
    const f = computeTradeFinancials({ ...closed, exitPrice: "100.5", fees: "2" });
    expect(s(f.netPnl)).toBe("-1");
    expect(f.result).toBe("LOSS");
  });

  it("manual override wins over the calculation", () => {
    const f = computeTradeFinancials({ ...closed, manualNetPnl: "-12.34" });
    expect(s(f.netPnl)).toBe("-12.34");
    expect(s(f.grossPnl)).toBe("-10.84");
    expect(f.pnlOverridden).toBe(true);
    expect(f.result).toBe("LOSS");
  });

  it("an explicit result is kept", () => {
    expect(computeTradeFinancials({ ...closed, exitPrice: "100.01", fees: "0", result: "BREAKEVEN" }).result).toBe("BREAKEVEN");
  });

  it("open trades have no P&L or result", () => {
    const f = computeTradeFinancials({ ...closed, status: "OPEN", exitPrice: null });
    expect(f.netPnl).toBeNull();
    expect(f.result).toBeNull();
    expect(s(f.riskReward)).toBe("2");
  });
});
