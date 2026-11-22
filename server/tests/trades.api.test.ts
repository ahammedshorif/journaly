import { Prisma } from "@prisma/client";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const TRADE_ID = "33333333-3333-4333-8333-333333333333";

const m = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    journalAccount: { findUniqueOrThrow: vi.fn() },
    transaction: { findMany: vi.fn() },
    trade: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    tradeTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    tag: { createMany: vi.fn(), findMany: vi.fn() },
  };
  const prisma = {
    user: { upsert: vi.fn() },
    journalAccount: { findFirst: vi.fn() },
    trade: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { tx, prisma };
});
vi.mock("../src/lib/prisma", () => ({ prisma: m.prisma }));

import { createApp } from "../src/app";

const app = createApp();

const token = () =>
  new SignJWT({ email: "t@example.com", role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer("https://test-project.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));

const account = {
  id: ACCOUNT_ID,
  userId: USER_ID,
  name: "Binance",
  platform: "BINANCE",
  initialBalance: new Prisma.Decimal("1000"),
  currency: "USDT",
  isArchived: false,
};

const validTrade = {
  symbol: "btcusdt",
  direction: "LONG",
  marketType: "FUTURES",
  status: "CLOSED",
  entryPrice: "60000",
  exitPrice: "61000",
  quantity: "0.1",
  fees: "4",
  stopLoss: "59500",
  takeProfit: "61000",
  riskType: "PERCENT",
  riskValue: "1",
  emotionBefore: "CONFIDENT",
  tags: ["breakout", "Breakout", "london"],
  openedAt: "2026-11-01T09:00:00Z",
  closedAt: "2026-11-01T12:00:00Z",
};

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: TRADE_ID,
  accountId: ACCOUNT_ID,
  account: { id: ACCOUNT_ID, name: "Binance", currency: "USDT" },
  symbol: "BTCUSDT",
  direction: "LONG",
  marketType: "FUTURES",
  status: "CLOSED",
  entryPrice: new Prisma.Decimal("60000"),
  exitPrice: new Prisma.Decimal("61000"),
  quantity: new Prisma.Decimal("0.1"),
  contractSize: null,
  leverage: null,
  fees: new Prisma.Decimal("4"),
  stopLoss: null,
  takeProfit: null,
  riskType: null,
  riskValue: null,
  riskAmount: null,
  riskReward: null,
  result: "PROFIT",
  resultOverridden: false,
  targetHit: false,
  slHit: false,
  grossPnl: new Prisma.Decimal("100"),
  netPnl: new Prisma.Decimal("96"),
  pnlOverridden: false,
  balanceAfter: new Prisma.Decimal("1096"),
  emotionBefore: null,
  emotionAfter: null,
  setup: null,
  strategy: null,
  timeframe: null,
  mistakes: null,
  notes: null,
  tags: [],
  screenshotPath: null,
  openedAt: new Date("2026-11-01T09:00:00Z"),
  closedAt: new Date("2026-11-01T12:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.journalAccount.findFirst.mockResolvedValue(account);
  m.tx.journalAccount.findUniqueOrThrow.mockResolvedValue({ initialBalance: new Prisma.Decimal("1000") });
  m.tx.transaction.findMany.mockResolvedValue([]);
  m.tx.trade.findMany.mockResolvedValue([]);
  m.tx.trade.create.mockResolvedValue({ id: TRADE_ID });
  m.tx.trade.findUniqueOrThrow.mockResolvedValue(dbRow());
  m.tx.tag.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
});

describe("POST /accounts/:id/trades", () => {
  it("stores the calculated P&L, R:R and risk, then recomputes balances", async () => {
    const res = await request(app)
      .post(`/api/v1/accounts/${ACCOUNT_ID}/trades`)
      .set("Authorization", `Bearer ${await token()}`)
      .send(validTrade);

    expect(res.status).toBe(201);
    const data = m.tx.trade.create.mock.calls[0]![0].data;
    expect(data.symbol).toBe("BTCUSDT");
    expect(data.grossPnl.toString()).toBe("100"); // (61000-60000)*0.1
    expect(data.netPnl.toString()).toBe("96"); // minus fees
    expect(data.result).toBe("PROFIT");
    expect(data.riskReward.toString()).toBe("2"); // 1000 / 500
    expect(data.riskAmount.toString()).toBe("10"); // 1% of 1000
    expect(data.userId).toBe(USER_ID);
    expect(data).not.toHaveProperty("manualNetPnl");
    expect(data).not.toHaveProperty("tags");

    // Tags de-duplicated case-insensitively
    expect(m.tx.tag.createMany.mock.calls[0]![0].data.map((t: { name: string }) => t.name)).toEqual(["Breakout", "london"]);
    // Account locked and balances recomputed in the same transaction
    expect(m.tx.$queryRaw).toHaveBeenCalled();
    expect(m.tx.trade.updateMany).toHaveBeenCalled();
    expect(res.body.data.netPnl).toBe("96");
  });

  it("rejects a closed trade without exit price / close date", async () => {
    const res = await request(app)
      .post(`/api/v1/accounts/${ACCOUNT_ID}/trades`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ ...validTrade, exitPrice: "", closedAt: null });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["exitPrice", "closedAt"]));
    expect(m.tx.trade.create).not.toHaveBeenCalled();
  });

  it("rejects a close date before the open date", async () => {
    const res = await request(app)
      .post(`/api/v1/accounts/${ACCOUNT_ID}/trades`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ ...validTrade, closedAt: "2026-10-31T00:00:00Z" });
    expect(res.status).toBe(400);
  });

  it("rejects a screenshot path outside the user's folder", async () => {
    const res = await request(app)
      .post(`/api/v1/accounts/${ACCOUNT_ID}/trades`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ ...validTrade, screenshotPath: "someone-else/chart.png" });
    expect(res.status).toBe(400);
  });

  it("refuses trades on archived accounts", async () => {
    m.prisma.journalAccount.findFirst.mockResolvedValue({ ...account, isArchived: true });
    const res = await request(app)
      .post(`/api/v1/accounts/${ACCOUNT_ID}/trades`)
      .set("Authorization", `Bearer ${await token()}`)
      .send(validTrade);
    expect(res.status).toBe(422);
  });

  it("open trades are saved without P&L", async () => {
    await request(app)
      .post(`/api/v1/accounts/${ACCOUNT_ID}/trades`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ ...validTrade, status: "OPEN", exitPrice: "", closedAt: null })
      .expect(201);
    const data = m.tx.trade.create.mock.calls[0]![0].data;
    expect(data.netPnl).toBeNull();
    expect(data.result).toBeNull();
    expect(data.closedAt).toBeNull();
  });
});

describe("PATCH /trades/:id", () => {
  it("re-validates the merged trade and recalculates P&L", async () => {
    m.prisma.trade.findFirst.mockResolvedValue(dbRow());
    m.tx.trade.update.mockResolvedValue({});
    const res = await request(app)
      .patch(`/api/v1/trades/${TRADE_ID}`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ exitPrice: "59000" });

    expect(res.status).toBe(200);
    const data = m.tx.trade.update.mock.calls[0]![0].data;
    expect(data.netPnl.toString()).toBe("-104"); // (59000-60000)*0.1 - 4
    expect(data.result).toBe("LOSS");
  });

  it("keeps a manually chosen result when the price changes", async () => {
    m.prisma.trade.findFirst.mockResolvedValue(dbRow({ result: "BREAKEVEN", resultOverridden: true }));
    m.tx.trade.update.mockResolvedValue({});
    await request(app)
      .patch(`/api/v1/trades/${TRADE_ID}`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ exitPrice: "60010" })
      .expect(200);
    const data = m.tx.trade.update.mock.calls[0]![0].data;
    expect(data.result).toBe("BREAKEVEN");
    expect(data.resultOverridden).toBe(true);
  });

  it("returns 404 for another user's trade", async () => {
    m.prisma.trade.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/v1/trades/${TRADE_ID}`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ notes: "x" });
    expect(res.status).toBe(404);
  });

  it("rejects unknown fields", async () => {
    m.prisma.trade.findFirst.mockResolvedValue(dbRow());
    const res = await request(app)
      .patch(`/api/v1/trades/${TRADE_ID}`)
      .set("Authorization", `Bearer ${await token()}`)
      .send({ userId: "hijack" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /trades/:id", () => {
  it("deletes and recomputes balances", async () => {
    m.prisma.trade.findFirst.mockResolvedValue(dbRow());
    await request(app).delete(`/api/v1/trades/${TRADE_ID}`).set("Authorization", `Bearer ${await token()}`).expect(204);
    expect(m.tx.trade.delete).toHaveBeenCalledWith({ where: { id: TRADE_ID } });
    expect(m.tx.trade.updateMany).toHaveBeenCalled();
  });
});
