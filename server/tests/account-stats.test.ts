import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeAccountStats, computeBalance } from "../src/domain/account-stats";

const D = (v: string | number) => new Prisma.Decimal(v);

const base = {
  initialBalance: D("1000"),
  totalDeposits: D("0"),
  totalWithdrawals: D("0"),
  closedNetPnl: D("0"),
  wins: 0,
  losses: 0,
  breakevens: 0,
};

describe("computeAccountStats", () => {
  it("returns the initial balance for a fresh account", () => {
    const s = computeAccountStats(base);
    expect(s.currentBalance).toBe("1000.00");
    expect(s.totalPnl).toBe("0.00");
    expect(s.roiPercent).toBe("0.00");
    expect(s.winRate).toBeNull();
    expect(s.closedTrades).toBe(0);
  });

  it("balance = initial + deposits − withdrawals + closed P&L", () => {
    const s = computeAccountStats({
      ...base,
      totalDeposits: D("500"),
      totalWithdrawals: D("200"),
      closedNetPnl: D("130.55"),
    });
    expect(s.currentBalance).toBe("1430.55");
    expect(s.netDeposits).toBe("300.00");
    expect(s.investedCapital).toBe("1300.00");
  });

  it("ROI is P&L relative to invested capital", () => {
    const s = computeAccountStats({ ...base, totalDeposits: D("1000"), closedNetPnl: D("-150") });
    // -150 / 2000
    expect(s.roiPercent).toBe("-7.50");
  });

  it("ROI is null when invested capital is zero", () => {
    const s = computeAccountStats({ ...base, initialBalance: D("0"), closedNetPnl: D("10") });
    expect(s.roiPercent).toBeNull();
  });

  it("win rate excludes breakevens", () => {
    const s = computeAccountStats({ ...base, wins: 3, losses: 1, breakevens: 4 });
    expect(s.winRate).toBe("75.00");
    expect(s.closedTrades).toBe(8);
  });

  it("does not lose precision with decimals (no float drift)", () => {
    const b = computeBalance({
      initialBalance: D("0.1"),
      totalDeposits: D("0.2"),
      totalWithdrawals: D("0"),
      closedNetPnl: D("0"),
    });
    expect(b.toString()).toBe("0.3");
  });
});
