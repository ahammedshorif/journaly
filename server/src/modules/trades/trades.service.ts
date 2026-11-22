import { Prisma, TradeResult, TradeStatus } from "@prisma/client";
import { computeTradeFinancials, type TradeFinancials } from "../../domain/trade-calc";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/http-error";
import { toDecimal } from "../../utils/money";
import { findOwnedAccount } from "../accounts/accounts.service";
import { getBalanceAt, lockAccount, recomputeAccountBalances } from "./balance.service";
import { tradeInputSchema, tradeUpdateSchema, type ListTradesQuery, type TradeInput } from "./trades.schema";

type Tx = Prisma.TransactionClient;

export const tradeInclude = {
  tags: { include: { tag: { select: { name: true } } } },
  account: { select: { id: true, name: true, currency: true } },
} satisfies Prisma.TradeInclude;

type TradeWithRelations = Prisma.TradeGetPayload<{ include: typeof tradeInclude }>;

/** Decimal → plain string without exponent notation (decimal.js prints 1e-8 otherwise). */
const dec = (v: Prisma.Decimal | null) => (v === null ? null : v.toFixed());

export function serializeTrade(t: TradeWithRelations) {
  return {
    id: t.id,
    accountId: t.accountId,
    account: t.account,
    symbol: t.symbol,
    direction: t.direction,
    marketType: t.marketType,
    status: t.status,
    entryPrice: dec(t.entryPrice)!,
    exitPrice: dec(t.exitPrice),
    quantity: dec(t.quantity)!,
    contractSize: dec(t.contractSize),
    leverage: dec(t.leverage),
    fees: dec(t.fees)!,
    stopLoss: dec(t.stopLoss),
    takeProfit: dec(t.takeProfit),
    riskType: t.riskType,
    riskValue: dec(t.riskValue),
    riskAmount: dec(t.riskAmount),
    riskReward: dec(t.riskReward),
    result: t.result,
    resultOverridden: t.resultOverridden,
    targetHit: t.targetHit,
    slHit: t.slHit,
    grossPnl: dec(t.grossPnl),
    netPnl: dec(t.netPnl),
    pnlOverridden: t.pnlOverridden,
    balanceAfter: dec(t.balanceAfter),
    emotionBefore: t.emotionBefore,
    emotionAfter: t.emotionAfter,
    setup: t.setup,
    strategy: t.strategy,
    timeframe: t.timeframe,
    mistakes: t.mistakes,
    notes: t.notes,
    tags: t.tags.map((tt) => tt.tag.name).sort((a, b) => a.localeCompare(b)),
    screenshotPath: t.screenshotPath,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** Existing row → the shape accepted by tradeInputSchema (used to validate merged PATCHes). */
function toInputShape(t: TradeWithRelations) {
  return {
    symbol: t.symbol,
    direction: t.direction,
    marketType: t.marketType,
    status: t.status,
    entryPrice: dec(t.entryPrice),
    exitPrice: dec(t.exitPrice),
    quantity: dec(t.quantity),
    contractSize: dec(t.contractSize),
    leverage: dec(t.leverage),
    fees: dec(t.fees),
    stopLoss: dec(t.stopLoss),
    takeProfit: dec(t.takeProfit),
    riskType: t.riskType,
    riskValue: dec(t.riskValue),
    result: t.resultOverridden ? t.result : null, // auto results are re-derived
    targetHit: t.targetHit,
    slHit: t.slHit,
    manualNetPnl: t.pnlOverridden ? dec(t.netPnl) : null,
    emotionBefore: t.emotionBefore,
    emotionAfter: t.emotionAfter,
    setup: t.setup,
    strategy: t.strategy,
    timeframe: t.timeframe,
    mistakes: t.mistakes,
    notes: t.notes,
    tags: t.tags.map((tt) => tt.tag.name),
    screenshotPath: t.screenshotPath,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
  };
}

function toData(input: TradeInput, fin: TradeFinancials) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tags, manualNetPnl, ...fields } = input;
  return {
    ...fields,
    grossPnl: fin.grossPnl,
    netPnl: fin.netPnl,
    pnlOverridden: fin.pnlOverridden,
    result: fin.result,
    resultOverridden: fin.resultOverridden,
    riskAmount: fin.riskAmount,
    riskReward: fin.riskReward,
  };
}

function assertScreenshotPath(userId: string, path: string | null) {
  // Storage RLS restricts uploads to <userId>/…; never let a trade point at someone else's file.
  if (path && (!path.startsWith(`${userId}/`) || path.includes(".."))) {
    throw HttpError.badRequest("Invalid screenshot path");
  }
}

async function syncTags(tx: Tx, userId: string, tradeId: string, names: string[]) {
  await tx.tradeTag.deleteMany({ where: { tradeId } });
  if (names.length === 0) return;
  await tx.tag.createMany({ data: names.map((name) => ({ userId, name })), skipDuplicates: true });
  const tags = await tx.tag.findMany({ where: { userId, name: { in: names } }, select: { id: true } });
  await tx.tradeTag.createMany({ data: tags.map((t) => ({ tradeId, tagId: t.id })) });
}

async function findOwnedTrade(userId: string, id: string) {
  const trade = await prisma.trade.findFirst({ where: { id, userId }, include: tradeInclude });
  if (!trade) throw HttpError.notFound("Trade not found");
  return trade;
}

export function buildWhere(userId: string, q: ListTradesQuery): Prisma.TradeWhereInput {
  const and: Prisma.TradeWhereInput[] = [];
  const where: Prisma.TradeWhereInput = { userId, AND: and };

  if (q.accountId) where.accountId = q.accountId;
  if (q.from || q.to) where.openedAt = { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) };
  if (q.symbol) where.symbol = q.symbol;
  if (q.result?.length) where.result = { in: q.result };
  if (q.status) where.status = q.status;
  if (q.direction) where.direction = q.direction;
  if (q.marketType) where.marketType = q.marketType;
  if (q.strategy) where.strategy = { equals: q.strategy, mode: "insensitive" };
  if (q.tag) where.tags = { some: { tag: { name: { equals: q.tag, mode: "insensitive" } } } };
  if (q.emotion) and.push({ OR: [{ emotionBefore: q.emotion }, { emotionAfter: q.emotion }] });
  if (q.q) {
    const contains = { contains: q.q, mode: "insensitive" as const };
    and.push({
      OR: [{ symbol: contains }, { setup: contains }, { strategy: contains }, { notes: contains }, { mistakes: contains }],
    });
  }
  return where;
}

export function buildOrderBy(q: ListTradesQuery): Prisma.TradeOrderByWithRelationInput[] {
  const nullable = q.sortBy === "netPnl" || q.sortBy === "closedAt";
  const primary = nullable ? { [q.sortBy]: { sort: q.sortDir, nulls: "last" } } : { [q.sortBy]: q.sortDir };
  return [primary as Prisma.TradeOrderByWithRelationInput, { createdAt: "desc" }, { id: "asc" }];
}

const TX_OPTIONS = { timeout: 15_000 };

export const tradesService = {
  async list(userId: string, q: ListTradesQuery) {
    if (q.accountId) await findOwnedAccount(userId, q.accountId);
    const where = buildWhere(userId, q);
    const closedWhere = { AND: [where, { status: TradeStatus.CLOSED }] };

    const [items, total, pnl, results] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: tradeInclude,
        orderBy: buildOrderBy(q),
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.trade.count({ where }),
      prisma.trade.aggregate({ where: closedWhere, _sum: { netPnl: true } }),
      prisma.trade.groupBy({ by: ["result"], where: closedWhere, _count: { _all: true } }),
    ]);

    const count = (r: TradeResult) => results.find((g) => g.result === r)?._count._all ?? 0;
    const wins = count(TradeResult.PROFIT);
    const losses = count(TradeResult.LOSS);

    return {
      items: items.map(serializeTrade),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      summary: {
        netPnl: toDecimal(pnl._sum.netPnl).toFixed(2),
        closedTrades: results.reduce((n, g) => n + g._count._all, 0),
        wins,
        losses,
        breakevens: count(TradeResult.BREAKEVEN),
        winRate: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : null,
      },
    };
  },

  async get(userId: string, id: string) {
    return serializeTrade(await findOwnedTrade(userId, id));
  },

  /** Distinct values for filter dropdowns and form autocomplete. */
  async meta(userId: string) {
    const [symbols, strategies, tags] = await Promise.all([
      prisma.trade.findMany({ where: { userId }, distinct: ["symbol"], select: { symbol: true }, orderBy: { symbol: "asc" }, take: 500 }),
      prisma.trade.findMany({
        where: { userId, strategy: { not: null } },
        distinct: ["strategy"],
        select: { strategy: true },
        orderBy: { strategy: "asc" },
        take: 200,
      }),
      prisma.tag.findMany({ where: { userId }, select: { name: true }, orderBy: { name: "asc" } }),
    ]);
    return {
      symbols: symbols.map((s) => s.symbol),
      strategies: strategies.map((s) => s.strategy!).filter(Boolean),
      tags: tags.map((t) => t.name),
    };
  },

  async create(userId: string, accountId: string, input: TradeInput) {
    const account = await findOwnedAccount(userId, accountId);
    if (account.isArchived) throw HttpError.unprocessable("Can't add trades to an archived account");
    assertScreenshotPath(userId, input.screenshotPath);

    const trade = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, accountId);
      const balanceAtEntry = await getBalanceAt(tx, accountId, input.openedAt);
      const fin = computeTradeFinancials({ ...input, balanceAtEntry });

      const created = await tx.trade.create({ data: { ...toData(input, fin), userId, accountId } });
      await syncTags(tx, userId, created.id, input.tags);
      await recomputeAccountBalances(tx, accountId);
      return tx.trade.findUniqueOrThrow({ where: { id: created.id }, include: tradeInclude });
    }, TX_OPTIONS);

    return serializeTrade(trade);
  },

  async update(userId: string, id: string, body: unknown) {
    const existing = await findOwnedTrade(userId, id);
    tradeUpdateSchema.parse(body); // rejects unknown keys / bad types early
    // Re-validate the merged trade so cross-field rules (closed ⇒ exit + close date…) still hold.
    const input = tradeInputSchema.parse({ ...toInputShape(existing), ...(body as object) });
    assertScreenshotPath(userId, input.screenshotPath);

    const trade = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, existing.accountId);
      const balanceAtEntry = await getBalanceAt(tx, existing.accountId, input.openedAt, id);
      const fin = computeTradeFinancials({ ...input, balanceAtEntry });

      await tx.trade.update({ where: { id }, data: toData(input, fin) });
      await syncTags(tx, userId, id, input.tags);
      await recomputeAccountBalances(tx, existing.accountId);
      return tx.trade.findUniqueOrThrow({ where: { id }, include: tradeInclude });
    }, TX_OPTIONS);

    return serializeTrade(trade);
  },

  async remove(userId: string, id: string) {
    const existing = await findOwnedTrade(userId, id);
    await prisma.$transaction(async (tx) => {
      await lockAccount(tx, existing.accountId);
      await tx.trade.delete({ where: { id } });
      await recomputeAccountBalances(tx, existing.accountId);
    }, TX_OPTIONS);
    return { screenshotPath: existing.screenshotPath };
  },
};
