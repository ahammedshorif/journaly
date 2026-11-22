import { Emotion, MarketType, RiskType, TradeDirection, TradeResult, TradeStatus } from "@prisma/client";
import { z } from "zod";
import { moneySchema, nonNegativeMoney, optionalDecimal, positiveMoney } from "../../utils/money";
import { optionalText } from "../../utils/validation";

const leverageSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,6}(\.\d{1,2})?$/.test(v) && Number(v) >= 1 && Number(v) <= 1000, "Leverage must be 1–1000");

const tagSchema = z.string().trim().min(1).max(40);

/** Fields only; cross-field rules live in `refineTrade` so updates can re-validate the merged result. */
export const tradeFieldsSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Symbol is required")
    .max(30)
    .regex(/^[A-Z0-9._:/-]+$/, "Letters, numbers and . _ : / - only"),
  direction: z.enum(TradeDirection),
  marketType: z.enum(MarketType),
  status: z.enum(TradeStatus).default(TradeStatus.CLOSED),

  entryPrice: positiveMoney,
  exitPrice: optionalDecimal(positiveMoney),
  quantity: positiveMoney,
  contractSize: optionalDecimal(positiveMoney),
  leverage: optionalDecimal(leverageSchema),
  fees: z.union([z.literal(""), nonNegativeMoney]).optional().transform((v) => (v ? v : "0")),

  stopLoss: optionalDecimal(positiveMoney),
  takeProfit: optionalDecimal(positiveMoney),
  riskType: z.enum(RiskType).nullish().transform((v) => v ?? null),
  riskValue: optionalDecimal(positiveMoney),

  result: z.enum(TradeResult).nullish().transform((v) => v ?? null),
  targetHit: z.boolean().default(false),
  slHit: z.boolean().default(false),
  manualNetPnl: optionalDecimal(moneySchema),

  emotionBefore: z.enum(Emotion).nullish().transform((v) => v ?? null),
  emotionAfter: z.enum(Emotion).nullish().transform((v) => v ?? null),
  setup: optionalText(5000),
  strategy: optionalText(100),
  timeframe: optionalText(20),
  mistakes: optionalText(5000),
  notes: optionalText(5000),
  tags: z
    .array(tagSchema)
    .max(20, "Max 20 tags")
    .default([])
    .transform((tags) => [...new Map(tags.map((t) => [t.toLowerCase(), t])).values()]),
  screenshotPath: optionalText(300),

  openedAt: z.coerce.date({ error: "Open date is required" }),
  closedAt: z.coerce.date().nullish().transform((v) => v ?? null),
});

type TradeFields = z.output<typeof tradeFieldsSchema>;

function refineTrade(t: TradeFields, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

  if (t.openedAt.getTime() > Date.now() + 60_000) issue("openedAt", "Open date can't be in the future");

  if (t.status === "CLOSED") {
    if (!t.exitPrice && !t.manualNetPnl) issue("exitPrice", "Exit price is required for a closed trade");
    if (!t.closedAt) issue("closedAt", "Close date is required for a closed trade");
    else {
      if (t.closedAt < t.openedAt) issue("closedAt", "Close date must be after the open date");
      if (t.closedAt.getTime() > Date.now() + 60_000) issue("closedAt", "Close date can't be in the future");
    }
  }

  if ((t.riskType === null) !== (t.riskValue === null)) issue("riskValue", "Enter both risk type and value");
  if (t.riskType === "PERCENT" && t.riskValue && Number(t.riskValue) > 100) issue("riskValue", "Risk % can't exceed 100");
  if (t.targetHit && t.slHit) issue("slHit", "A trade can't hit both target and stop loss");
}

/** Normalises fields that don't apply to open trades. */
function normalise(t: TradeFields): TradeFields {
  if (t.status === "OPEN") {
    return { ...t, exitPrice: null, closedAt: null, result: null, manualNetPnl: null, targetHit: false, slHit: false };
  }
  return t;
}

export const tradeInputSchema = tradeFieldsSchema.strict().superRefine(refineTrade).transform(normalise);
export const tradeUpdateSchema = tradeFieldsSchema.partial().strict();
export type TradeInput = z.output<typeof tradeInputSchema>;

export const createTradeBodySchema = z.object({ accountId: z.uuid("Invalid account id") });

const csvEnum = <T extends Record<string, string>>(e: T) =>
  z
    .union([z.enum(e), z.array(z.enum(e))])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]));

export const listTradesQuerySchema = z.object({
  accountId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["openedAt", "closedAt", "netPnl", "symbol", "createdAt"]).default("openedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  symbol: z.string().trim().toUpperCase().max(30).optional(),
  result: csvEnum(TradeResult),
  status: z.enum(TradeStatus).optional(),
  direction: z.enum(TradeDirection).optional(),
  marketType: z.enum(MarketType).optional(),
  emotion: z.enum(Emotion).optional(),
  strategy: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(40).optional(),
  q: z.string().trim().max(100).optional(),
});

export type ListTradesQuery = z.output<typeof listTradesQuerySchema>;
