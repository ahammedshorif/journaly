import { describe, expect, it } from "vitest";
import {
  breakdownByEmotion,
  breakdownByHour,
  breakdownByPeriod,
  breakdownByWeekday,
  computeEquityCurve,
  computeMetrics,
  type ClosedTrade,
} from "../src/domain/analytics";
import { dayKey, dayKeysBetween, startOfDay, startOfMonth, startOfWeek, weekKey, zonedParts } from "../src/domain/time";

let n = 0;
function trade(netPnl: string, closedAt: string, extra: Partial<ClosedTrade> = {}): ClosedTrade {
  const pnl = Number(netPnl);
  n++;
  return {
    id: `t${String(n).padStart(3, "0")}`,
    accountId: "a",
    symbol: "BTCUSDT",
    direction: "LONG",
    result: pnl > 0 ? "PROFIT" : pnl < 0 ? "LOSS" : "BREAKEVEN",
    netPnl,
    fees: "1",
    riskAmount: null,
    riskReward: null,
    strategy: null,
    emotionBefore: null,
    emotionAfter: null,
    openedAt: new Date(closedAt),
    closedAt: new Date(closedAt),
    createdAt: new Date(closedAt),
    ...extra,
  };
}

describe("computeMetrics", () => {
  const trades = [
    trade("100", "2026-01-01T10:00:00Z", { riskAmount: "50", riskReward: "2" }),
    trade("50", "2026-01-02T10:00:00Z", { riskAmount: "50", riskReward: "3" }),
    trade("-80", "2026-01-03T10:00:00Z", { riskAmount: "40" }),
    trade("-40", "2026-01-04T10:00:00Z"),
    trade("-20", "2026-01-05T10:00:00Z"),
    trade("0", "2026-01-06T10:00:00Z"),
    trade("200", "2026-01-07T10:00:00Z"),
  ];
  const m = computeMetrics(trades, { startBalance: "1000" });

  it("totals", () => {
    expect(m.netPnl).toBe("210.00");
    expect(m.grossProfit).toBe("350.00");
    expect(m.grossLoss).toBe("140.00");
    expect(m.totalFees).toBe("7.00");
    expect(m.totalTrades).toBe(7);
    expect([m.wins, m.losses, m.breakevens]).toEqual([3, 3, 1]);
  });

  it("ratios", () => {
    expect(m.winRate).toBe("50.00");
    expect(m.profitFactor).toBe("2.50"); // 350 / 140
    expect(m.expectancy).toBe("30.00"); // 210 / 7
    expect(m.roiPercent).toBe("21.00");
    expect(m.avgWin).toBe("116.67");
    expect(m.avgLoss).toBe("-46.67");
    expect(m.largestWin).toBe("200.00");
    expect(m.largestLoss).toBe("-80.00");
    expect(m.avgRiskReward).toBe("2.50");
    expect(m.avgRMultiple).toBe("0.33"); // (100/50 + 50/50 − 80/40) / 3
  });

  it("streaks (breakeven breaks a streak)", () => {
    expect(m.longestWinStreak).toBe(2);
    expect(m.longestLossStreak).toBe(3);
  });

  it("max drawdown from peak 1150 to 1010 = 140 (12.17%)", () => {
    expect(m.maxDrawdown).toBe("140.00");
    expect(m.maxDrawdownPercent).toBe("12.17");
  });

  it("handles no trades", () => {
    const e = computeMetrics([], { startBalance: "500" });
    expect(e.netPnl).toBe("0.00");
    expect(e.winRate).toBeNull();
    expect(e.profitFactor).toBeNull();
    expect(e.maxDrawdown).toBe("0.00");
  });

  it("profit factor is null with no losing trades", () => {
    expect(computeMetrics([trade("10", "2026-01-01T00:00:00Z")], { startBalance: "100" }).profitFactor).toBeNull();
  });

  it("respects a manually set result over the sign of P&L", () => {
    const x = computeMetrics([trade("0.5", "2026-01-01T00:00:00Z", { result: "BREAKEVEN" })], { startBalance: "100" });
    expect([x.wins, x.breakevens]).toEqual([0, 1]);
  });
});

describe("timezone bucketing", () => {
  const tz = "Asia/Dhaka"; // UTC+6, no DST
  it("a 20:00 UTC close is the next day in Dhaka", () => {
    expect(dayKey(new Date("2026-03-01T20:00:00Z"), tz)).toBe("2026-03-02");
    expect(zonedParts(new Date("2026-03-01T20:00:00Z"), tz).hour).toBe(2);
  });
  it("weeks start on Monday", () => {
    // 2026-11-21 is a Saturday
    expect(weekKey(new Date("2026-11-21T06:00:00Z"), tz)).toBe("2026-11-16");
  });
  it("start of day/week/month in local time", () => {
    const at = new Date("2026-11-21T14:00:00Z");
    expect(startOfDay(at, tz).toISOString()).toBe("2026-11-20T18:00:00.000Z");
    expect(startOfWeek(at, tz).toISOString()).toBe("2026-11-15T18:00:00.000Z");
    expect(startOfMonth(at, tz).toISOString()).toBe("2026-10-31T18:00:00.000Z");
  });
  it("is DST-safe (New York, spring forward)", () => {
    expect(startOfDay(new Date("2026-03-08T15:00:00Z"), "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(startOfDay(new Date("2026-03-09T15:00:00Z"), "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
  it("lists calendar days between two instants", () => {
    expect(dayKeysBetween(new Date("2026-02-27T00:00:00Z"), new Date("2026-03-02T00:00:00Z"), "UTC")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});

describe("breakdowns", () => {
  const trades = [
    trade("10", "2026-11-16T03:00:00Z", { emotionBefore: "CALM" }), // Mon
    trade("-30", "2026-11-16T05:00:00Z", { emotionBefore: "FOMO" }),
    trade("-20", "2026-11-18T05:00:00Z", { emotionBefore: "FOMO" }), // Wed
    trade("40", "2026-12-01T05:00:00Z", { emotionBefore: "CALM" }),
  ];

  it("by month", () => {
    const b = breakdownByPeriod(trades, "monthly", "UTC");
    expect(b.map((x) => [x.key, x.netPnl, x.trades])).toEqual([
      ["2026-11", "-40.00", 3],
      ["2026-12", "40.00", 1],
    ]);
  });

  it("weekday always returns 7 rows Mon..Sun", () => {
    const b = breakdownByWeekday(trades, "UTC");
    expect(b).toHaveLength(7);
    expect(b[0]).toMatchObject({ label: "Mon", netPnl: "-20.00", trades: 2 });
    expect(b[2]).toMatchObject({ label: "Wed", netPnl: "-20.00" });
    expect(b[6]).toMatchObject({ label: "Sun", trades: 0 });
  });

  it("hour returns 24 rows", () => {
    const b = breakdownByHour(trades, "UTC");
    expect(b).toHaveLength(24);
    expect(b[5]!.trades).toBe(3);
  });

  it("emotions sorted most expensive first", () => {
    const b = breakdownByEmotion(trades, "before");
    expect(b[0]).toMatchObject({ key: "FOMO", netPnl: "-50.00", winRate: "0.00" });
    expect(b[1]).toMatchObject({ key: "CALM", netPnl: "50.00", winRate: "100.00" });
  });
});

describe("computeEquityCurve", () => {
  const trades = [
    trade("100", "2026-01-10T00:00:00Z"),
    trade("-50", "2026-02-10T00:00:00Z"),
    trade("25", "2026-03-10T00:00:00Z"),
  ];
  const txs = [{ type: "DEPOSIT" as const, amount: "500", occurredAt: new Date("2026-02-01T00:00:00Z") }];

  it("starts with a baseline and includes cash flows", () => {
    const c = computeEquityCurve("1000", txs, trades);
    expect(c.map((p) => p.balance)).toEqual(["1000.00", "1100.00", "1550.00", "1575.00"]);
    expect(c.at(-1)!.cumulativePnl).toBe("75.00");
  });

  it("range: baseline is the balance at `from`", () => {
    const c = computeEquityCurve("1000", txs, trades, { from: new Date("2026-02-05T00:00:00Z") });
    expect(c.map((p) => p.balance)).toEqual(["1600.00", "1550.00", "1575.00"]);
    expect(c.at(-1)!.cumulativePnl).toBe("-25.00");
  });

  it("empty when no trades in range", () => {
    expect(computeEquityCurve("1000", [], trades, { from: new Date("2027-01-01") })).toEqual([]);
  });
});
