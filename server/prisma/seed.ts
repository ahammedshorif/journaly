/**
 * Demo data: 3 accounts, deposits/withdrawals, ~180 trades over the last 6 months, goals.
 *
 *   SEED_USER_EMAIL=you@gmail.com npm run db:seed
 *
 * - If a user with that email exists (sign in with Google once first), the demo data is added to it.
 * - Otherwise a stand-alone demo user is created (handy for inspecting data in Prisma Studio, but you can't log in as it).
 * Re-running replaces previous demo accounts (names ending in "(demo)"); your real accounts are never touched.
 */
import { Emotion, GoalType, MarketType, Platform, Prisma, PrismaClient, TradeDirection, TradeStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { computeTradeFinancials, resolveContractSize } from "../src/domain/trade-calc";
import { recomputeAccountBalances } from "../src/modules/trades/balance.service";

const prisma = new PrismaClient();
const DEMO_SUFFIX = " (demo)";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

// Deterministic PRNG so every seed run produces the same journal.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;

interface AccountSpec {
  name: string;
  platform: Platform;
  currency: string;
  initial: number;
  market: MarketType;
  symbols: { symbol: string; price: number; decimals: number; slPct: [number, number] }[];
  riskPct: number;
}

const ACCOUNTS: AccountSpec[] = [
  {
    name: "Binance Futures",
    platform: "BINANCE",
    currency: "USDT",
    initial: 2000,
    market: "FUTURES",
    riskPct: 1,
    symbols: [
      { symbol: "BTCUSDT", price: 64000, decimals: 1, slPct: [0.004, 0.012] },
      { symbol: "ETHUSDT", price: 3200, decimals: 2, slPct: [0.006, 0.015] },
      { symbol: "SOLUSDT", price: 150, decimals: 3, slPct: [0.01, 0.025] },
    ],
  },
  {
    name: "IC Markets Forex",
    platform: "FOREX",
    currency: "USD",
    initial: 5000,
    market: "FOREX",
    riskPct: 0.75,
    symbols: [
      { symbol: "EURUSD", price: 1.085, decimals: 5, slPct: [0.0012, 0.003] },
      { symbol: "GBPUSD", price: 1.27, decimals: 5, slPct: [0.0015, 0.0035] },
    ],
  },
  {
    name: "Gold Scalping",
    platform: "GOLD",
    currency: "USD",
    initial: 3000,
    market: "GOLD",
    riskPct: 1,
    symbols: [{ symbol: "XAUUSD", price: 2380, decimals: 2, slPct: [0.0015, 0.004] }],
  },
];

const STRATEGIES = ["Breakout retest", "Trend pullback", "Range fade", "Liquidity sweep", "News momentum"];
const TIMEFRAMES = ["5m", "15m", "1h", "4h"];
const TAGS = ["london", "new-york", "asia", "A+ setup", "impulsive", "scaled-out", "moved-SL", "high-impact-news"];
const SETUPS = [
  "Clean break of the range high with volume, entered on the retest.",
  "HTF trend up, pulled back into the 50 EMA and a demand zone.",
  "Swept the Asian low then reclaimed — classic liquidity grab.",
  "Rejection at resistance with bearish divergence on RSI.",
  "Momentum after CPI print, followed the first 5m candle close.",
];
const MISTAKES = [
  "Entered before confirmation candle closed.",
  "Moved stop loss further away — don't do this.",
  "Oversized after two wins.",
  "Took the trade out of boredom; no real setup.",
  "Chased the move after missing the entry.",
];

// Emotion strongly influences outcome so the emotion analysis has something to say.
const EMOTION_WIN_RATE: Partial<Record<Emotion, number>> = {
  CALM: 0.6,
  CONFIDENT: 0.57,
  NEUTRAL: 0.5,
  EXCITED: 0.45,
  BORED: 0.35,
  ANXIOUS: 0.38,
  FOMO: 0.28,
  REVENGE: 0.22,
  GREED: 0.33,
};
const BEFORE_EMOTIONS = Object.keys(EMOTION_WIN_RATE) as Emotion[];
const EMOTION_WEIGHTS = [5, 5, 3, 2, 1.5, 1.5, 2, 1, 1]; // CALM/CONFIDENT most common

function weightedEmotion(): Emotion {
  const total = EMOTION_WEIGHTS.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < BEFORE_EMOTIONS.length; i++) {
    r -= EMOTION_WEIGHTS[i]!;
    if (r <= 0) return BEFORE_EMOTIONS[i]!;
  }
  return "NEUTRAL";
}

const round = (n: number, dp: number) => Number(n.toFixed(dp));

async function resolveUser() {
  const email = process.env.SEED_USER_EMAIL ?? "demo@tradingjournal.dev";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`→ Seeding into existing user ${email}`);
    return existing;
  }
  console.log(`→ No user with ${email} yet — creating a stand-alone demo user (sign in once with Google, then re-run with SEED_USER_EMAIL to seed your own account).`);
  return prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: { id: DEMO_USER_ID, email, name: "Demo Trader", timezone: "Asia/Dhaka" },
    update: {},
  });
}

async function main() {
  const user = await resolveUser();

  const removed = await prisma.journalAccount.deleteMany({ where: { userId: user.id, name: { endsWith: DEMO_SUFFIX } } });
  if (removed.count) console.log(`→ Removed ${removed.count} previous demo account(s)`);

  const now = Date.now();
  const DAY = 86_400_000;
  const start = now - 180 * DAY;

  const tagRows = await Promise.all(
    TAGS.map((name) =>
      prisma.tag.upsert({ where: { userId_name: { userId: user.id, name } }, create: { userId: user.id, name }, update: {} }),
    ),
  );
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]));

  let totalTrades = 0;
  for (const spec of ACCOUNTS) {
    const account = await prisma.journalAccount.create({
      data: {
        userId: user.id,
        name: spec.name + DEMO_SUFFIX,
        platform: spec.platform,
        currency: spec.currency,
        initialBalance: spec.initial,
        notes: `Demo account. Risk ${spec.riskPct}% per trade, max 3 trades a day.`,
        createdAt: new Date(start - DAY),
      },
    });

    // Cash flows
    await prisma.transaction.createMany({
      data: [
        { userId: user.id, accountId: account.id, type: "DEPOSIT", amount: spec.initial * 0.25, note: "Top-up", occurredAt: new Date(start + 45 * DAY) },
        { userId: user.id, accountId: account.id, type: "WITHDRAWAL", amount: spec.initial * 0.1, note: "Paid myself", occurredAt: new Date(start + 120 * DAY) },
      ],
    });

    // Trades
    let balance = spec.initial;
    const prices = new Map(spec.symbols.map((s) => [s.symbol, s.price]));
    const count = spec.platform === "BINANCE" ? 80 : spec.platform === "FOREX" ? 60 : 45;
    const trades: Prisma.TradeCreateManyInput[] = [];
    const links: Prisma.TradeTagCreateManyInput[] = [];

    for (let i = 0; i < count; i++) {
      const sym = pick(spec.symbols);
      // gentle random walk so prices drift realistically
      const price = prices.get(sym.symbol)! * (1 + between(-0.03, 0.03));
      prices.set(sym.symbol, price);

      const direction: TradeDirection = chance(0.55) ? "LONG" : "SHORT";
      const emotionBefore = weightedEmotion();
      const entry = round(price, sym.decimals);
      const slDist = entry * between(sym.slPct[0], sym.slPct[1]);
      const rr = round(between(1.2, 3), 2);
      const sign = direction === "LONG" ? 1 : -1;
      const stopLoss = round(entry - sign * slDist, sym.decimals);
      const takeProfit = round(entry + sign * slDist * rr, sym.decimals);

      const contract = resolveContractSize(spec.market).toNumber();
      const riskUsd = Math.max(5, (balance * spec.riskPct) / 100);
      const qtyDp = spec.market === "FOREX" || spec.market === "GOLD" ? 2 : 3;
      const quantity = Math.max(1 / 10 ** qtyDp, round(riskUsd / (slDist * contract), qtyDp));

      const openedAt = new Date(start + (i / count) * 178 * DAY + between(0, 0.8) * DAY);
      const isOpen = i >= count - 2; // last couple still running
      const closedAt = new Date(Math.min(now - 60_000, openedAt.getTime() + between(0.25, 30) * 3_600_000));

      const winP = EMOTION_WIN_RATE[emotionBefore] ?? 0.5;
      const outcome = chance(0.06) ? "BE" : chance(winP) ? "WIN" : "LOSS";
      const rMove = outcome === "WIN" ? (chance(0.6) ? rr : between(0.5, rr)) : outcome === "LOSS" ? -between(0.9, 1.25) : between(-0.05, 0.05);
      const exitPrice = round(entry + sign * slDist * rMove, sym.decimals);
      const fees = round(spec.market === "FUTURES" ? entry * quantity * 0.0008 : quantity * (spec.market === "FOREX" ? 7 : 5), 2);

      const status: TradeStatus = isOpen ? "OPEN" : "CLOSED";
      const fin = computeTradeFinancials({
        status,
        direction,
        marketType: spec.market,
        entryPrice: String(entry),
        exitPrice: isOpen ? null : String(exitPrice),
        quantity: String(quantity),
        fees: String(fees),
        stopLoss: String(stopLoss),
        takeProfit: String(takeProfit),
        riskType: "PERCENT",
        riskValue: String(spec.riskPct),
        balanceAtEntry: String(balance),
      });
      if (fin.netPnl) balance += fin.netPnl.toNumber();

      const id = randomUUID();
      const loss = fin.result === "LOSS";
      trades.push({
        id,
        userId: user.id,
        accountId: account.id,
        symbol: sym.symbol,
        direction,
        marketType: spec.market,
        status,
        entryPrice: entry,
        exitPrice: isOpen ? null : exitPrice,
        quantity,
        leverage: spec.market === "FUTURES" ? pick([5, 10, 20]) : null,
        fees,
        stopLoss,
        takeProfit,
        riskType: "PERCENT",
        riskValue: spec.riskPct,
        riskAmount: fin.riskAmount,
        riskReward: fin.riskReward,
        result: fin.result,
        targetHit: !isOpen && outcome === "WIN" && rMove >= rr,
        slHit: !isOpen && outcome === "LOSS",
        grossPnl: fin.grossPnl,
        netPnl: fin.netPnl,
        emotionBefore,
        emotionAfter: isOpen ? null : loss ? pick(["FRUSTRATED", "ANXIOUS", "CALM"] as const) : pick(["CONFIDENT", "CALM", "EXCITED"] as const),
        setup: pick(SETUPS),
        strategy: pick(STRATEGIES),
        timeframe: pick(TIMEFRAMES),
        mistakes: loss && chance(0.6) ? pick(MISTAKES) : null,
        notes: chance(0.25) ? "Followed the plan." : null,
        openedAt,
        closedAt: isOpen ? null : closedAt,
        createdAt: openedAt,
      });
      const tags = new Set([pick(TAGS), ...(chance(0.4) ? [pick(TAGS)] : [])]);
      for (const t of tags) links.push({ tradeId: id, tagId: tagId.get(t)! });
    }

    await prisma.trade.createMany({ data: trades });
    await prisma.tradeTag.createMany({ data: links, skipDuplicates: true });
    await prisma.$transaction((tx) => recomputeAccountBalances(tx, account.id), { timeout: 30_000 });
    totalTrades += trades.length;
    console.log(`  ✓ ${spec.name}: ${trades.length} trades`);

    if (spec.platform === "BINANCE") {
      await prisma.goal.create({ data: { userId: user.id, accountId: account.id, type: GoalType.MAX_DAILY_LOSS, amount: 60 } });
    }
  }

  const hasMonthly = await prisma.goal.findFirst({ where: { userId: user.id, type: GoalType.MONTHLY_PROFIT, accountId: null, isActive: true } });
  if (!hasMonthly) await prisma.goal.create({ data: { userId: user.id, type: GoalType.MONTHLY_PROFIT, amount: 500 } });

  console.log(`✅ Seeded ${ACCOUNTS.length} accounts and ${totalTrades} trades for ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
