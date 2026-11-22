import { describe, expect, it } from "vitest";
import { balanceAt, computeBalanceTimeline } from "../src/domain/balance-timeline";

const d = (iso: string) => new Date(iso);

describe("computeBalanceTimeline", () => {
  it("accumulates net P&L in close order", () => {
    const out = computeBalanceTimeline(
      "1000",
      [],
      [
        { id: "b", closedAt: d("2026-01-02"), createdAt: d("2026-01-02"), netPnl: "-30" },
        { id: "a", closedAt: d("2026-01-01"), createdAt: d("2026-01-01"), netPnl: "50" },
      ],
    );
    expect(out.map((o) => [o.tradeId, o.balanceAfter.toString()])).toEqual([
      ["a", "1050"],
      ["b", "1020"],
    ]);
  });

  it("includes deposits/withdrawals made before each close", () => {
    const out = computeBalanceTimeline(
      "1000",
      [
        { type: "DEPOSIT", amount: "500", occurredAt: d("2026-01-01T12:00:00Z") },
        { type: "WITHDRAWAL", amount: "200", occurredAt: d("2026-01-03T00:00:00Z") },
      ],
      [
        { id: "t1", closedAt: d("2026-01-01T10:00:00Z"), createdAt: d("2026-01-01"), netPnl: "10" },
        { id: "t2", closedAt: d("2026-01-02T10:00:00Z"), createdAt: d("2026-01-02"), netPnl: "10" },
        { id: "t3", closedAt: d("2026-01-04T10:00:00Z"), createdAt: d("2026-01-04"), netPnl: "-5.5" },
      ],
    );
    expect(out.map((o) => o.balanceAfter.toString())).toEqual(["1010", "1520", "1314.5"]);
  });

  it("a transaction at exactly the close time counts first", () => {
    const t = d("2026-01-01T10:00:00Z");
    const out = computeBalanceTimeline("0", [{ type: "DEPOSIT", amount: "100", occurredAt: t }], [
      { id: "x", closedAt: t, createdAt: t, netPnl: "1" },
    ]);
    expect(out[0]!.balanceAfter.toString()).toBe("101");
  });

  it("breaks closedAt ties by createdAt", () => {
    const t = d("2026-01-01T10:00:00Z");
    const out = computeBalanceTimeline("100", [], [
      { id: "late", closedAt: t, createdAt: d("2026-01-05"), netPnl: "1" },
      { id: "early", closedAt: t, createdAt: d("2026-01-02"), netPnl: "2" },
    ]);
    expect(out.map((o) => o.tradeId)).toEqual(["early", "late"]);
  });

  it("final balance matches the account balance formula", () => {
    const out = computeBalanceTimeline(
      "1000",
      [
        { type: "DEPOSIT", amount: "250.25", occurredAt: d("2026-02-01") },
        { type: "WITHDRAWAL", amount: "100", occurredAt: d("2026-02-02") },
      ],
      [
        { id: "1", closedAt: d("2026-02-03"), createdAt: d("2026-02-03"), netPnl: "40.10" },
        { id: "2", closedAt: d("2026-02-04"), createdAt: d("2026-02-04"), netPnl: "-15.05" },
      ],
    );
    // 1000 + 250.25 − 100 + 40.10 − 15.05
    expect(out.at(-1)!.balanceAfter.toString()).toBe("1175.3");
  });
});

describe("balanceAt", () => {
  it("only counts events up to the given time", () => {
    const b = balanceAt(
      d("2026-03-02"),
      "1000",
      [
        { type: "DEPOSIT", amount: "100", occurredAt: d("2026-03-01") },
        { type: "DEPOSIT", amount: "999", occurredAt: d("2026-03-05") },
      ],
      [
        { closedAt: d("2026-03-01"), netPnl: "-50" },
        { closedAt: d("2026-03-10"), netPnl: "500" },
      ],
    );
    expect(b.toString()).toBe("1050");
  });
});
