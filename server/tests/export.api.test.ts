import { Prisma } from "@prisma/client";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const m = vi.hoisted(() => ({
  user: { upsert: vi.fn(), findUnique: vi.fn() },
  trade: { findMany: vi.fn() },
  journalAccount: { findFirst: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: m }));

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

const D = (v: string) => new Prisma.Decimal(v);
const row = {
  id: "t1",
  accountId: "a1",
  account: { id: "a1", name: "Binance", currency: "USDT" },
  symbol: "BTCUSDT",
  direction: "LONG",
  marketType: "FUTURES",
  status: "CLOSED",
  entryPrice: D("60000"),
  exitPrice: D("61000"),
  quantity: D("0.1"),
  contractSize: null,
  leverage: D("10"),
  fees: D("4"),
  stopLoss: D("59500"),
  takeProfit: D("61000"),
  riskType: "PERCENT",
  riskValue: D("1"),
  riskAmount: D("10"),
  riskReward: D("2"),
  result: "PROFIT",
  resultOverridden: false,
  targetHit: true,
  slHit: false,
  grossPnl: D("100"),
  netPnl: D("96"),
  pnlOverridden: false,
  balanceAfter: D("1096"),
  emotionBefore: "FOMO",
  emotionAfter: "CALM",
  setup: "=cmd|' /C calc'!A0", // formula-injection attempt
  strategy: "Breakout, retest",
  timeframe: "1h",
  mistakes: null,
  notes: 'He said "wait"',
  tags: [{ tag: { name: "london" } }],
  screenshotPath: null,
  openedAt: new Date("2026-11-01T09:00:00Z"),
  closedAt: new Date("2026-11-01T12:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  m.user.findUnique.mockResolvedValue({ timezone: "Asia/Dhaka" });
  m.trade.findMany.mockResolvedValue([row]);
});

describe("GET /export (trades)", () => {
  it("returns a safe CSV attachment scoped to the user", async () => {
    const res = await request(app)
      .get("/api/v1/export?type=trades&format=csv&result=PROFIT")
      .set("Authorization", `Bearer ${await token()}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="trades-\d{4}-\d{2}-\d{2}\.csv"/);
    const where = m.trade.findMany.mock.calls[0]![0].where;
    expect(where.userId).toBe(USER_ID);
    expect(where.result).toEqual({ in: ["PROFIT"] });

    const text: string = res.text;
    expect(text).toContain("BTCUSDT");
    expect(text).toContain('"Breakout, retest"');
    expect(text).toContain('"He said ""wait"""');
    expect(text).toContain("'=cmd"); // neutralised
    expect(text).toContain("96.00");
  });

  it("returns a PDF", async () => {
    const res = await request(app)
      .get("/api/v1/export?type=trades&format=pdf")
      .set("Authorization", `Bearer ${await token()}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("validates type/format", async () => {
    const res = await request(app).get("/api/v1/export?type=nope&format=csv").set("Authorization", `Bearer ${await token()}`);
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    expect((await request(app).get("/api/v1/export?type=trades&format=csv")).status).toBe(401);
  });
});
