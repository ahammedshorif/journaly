import { Prisma } from "@prisma/client";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma so API tests run without a database.
const prismaMock = vi.hoisted(() => ({
  user: { upsert: vi.fn() },
  journalAccount: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  transaction: { groupBy: vi.fn() },
  trade: { groupBy: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { createApp } from "../src/app";

const app = createApp();
const USER_ID = "11111111-1111-4111-8111-111111111111";

async function makeToken(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ email: "trader@example.com", role: "authenticated", user_metadata: { full_name: "Test Trader" }, ...overrides })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer("https://test-project.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transaction.groupBy.mockResolvedValue([]);
  prismaMock.trade.groupBy.mockResolvedValue([]);
});

describe("public routes", () => {
  it("GET /api/v1/health → 200", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("unknown route → 404 JSON", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("auth middleware", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/v1/accounts");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await request(app).get("/api/v1/accounts").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setIssuer("https://evil.example.com/auth/v1")
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));
    const res = await request(app).get("/api/v1/accounts").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("accepts a valid token, upserts the user and scopes queries to them", async () => {
    prismaMock.journalAccount.findMany.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        userId: USER_ID,
        name: "Binance Futures",
        platform: "BINANCE",
        initialBalance: new Prisma.Decimal("1000"),
        currency: "USDT",
        notes: null,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app)
      .get("/api/v1/accounts")
      .set("Authorization", `Bearer ${await makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.user.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.journalAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID, isArchived: false }) }),
    );
    expect(res.body.data[0].stats.currentBalance).toBe("1000.00");
  });
});

describe("validation", () => {
  it("rejects an account with a negative balance", async () => {
    const res = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${await makeToken()}`)
      .send({ name: "X", platform: "BINANCE", initialBalance: "-5" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.journalAccount.create).not.toHaveBeenCalled();
  });

  it("rejects unknown fields (strict schemas)", async () => {
    const res = await request(app)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${await makeToken()}`)
      .send({ name: "X", platform: "BINANCE", initialBalance: "5", userId: "someone-else" });
    expect(res.status).toBe(400);
  });
});
