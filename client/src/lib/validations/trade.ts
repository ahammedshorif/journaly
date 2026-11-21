import { z } from "zod";
import type { Emotion, Trade } from "@/types/api";

const DEC = /^\d{1,12}(\.\d{1,8})?$/;
const SIGNED_DEC = /^-?\d{1,12}(\.\d{1,8})?$/;

const requiredPositive = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(DEC, "Enter a valid number")
    .refine((v) => Number(v) > 0, "Must be greater than zero");

const optionalPositive = z
  .string()
  .trim()
  .refine((v) => v === "" || (DEC.test(v) && Number(v) > 0), "Enter a valid positive number");

const EMOTION_VALUES = [
  "CONFIDENT",
  "CALM",
  "NEUTRAL",
  "EXCITED",
  "FEAR",
  "GREED",
  "FOMO",
  "REVENGE",
  "ANXIOUS",
  "BORED",
  "FRUSTRATED",
  "IMPATIENT",
] as const satisfies readonly Emotion[];
const emotion = z.enum(["", ...EMOTION_VALUES]);

export const tradeFormSchema = z
  .object({
    accountId: z.string().min(1, "Pick an account"),
    symbol: z
      .string()
      .trim()
      .min(1, "Symbol is required")
      .max(30)
      .regex(/^[A-Za-z0-9._:/-]+$/, "Letters, numbers and . _ : / - only"),
    direction: z.enum(["LONG", "SHORT"]),
    marketType: z.enum(["SPOT", "FUTURES", "FOREX", "GOLD", "OTHER"]),
    status: z.enum(["OPEN", "CLOSED"]),

    entryPrice: requiredPositive("Entry price"),
    exitPrice: optionalPositive,
    quantity: requiredPositive("Quantity"),
    contractSize: optionalPositive,
    leverage: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) >= 1 && Number(v) <= 1000), "1–1000"),
    fees: z
      .string()
      .trim()
      .refine((v) => v === "" || DEC.test(v), "Enter a valid number"),

    stopLoss: optionalPositive,
    takeProfit: optionalPositive,
    riskType: z.enum(["", "AMOUNT", "PERCENT"]),
    riskValue: optionalPositive,

    result: z.enum(["AUTO", "PROFIT", "LOSS", "BREAKEVEN"]),
    targetHit: z.boolean(),
    slHit: z.boolean(),
    overridePnl: z.boolean(),
    manualNetPnl: z.string().trim(),

    emotionBefore: emotion,
    emotionAfter: emotion,
    setup: z.string().max(5000, "Max 5000 characters"),
    strategy: z.string().trim().max(100, "Max 100 characters"),
    timeframe: z.string().trim().max(20),
    mistakes: z.string().max(5000, "Max 5000 characters"),
    notes: z.string().max(5000, "Max 5000 characters"),
    tags: z.array(z.string().trim().min(1).max(40)).max(20, "Max 20 tags"),
    screenshotPath: z.string().nullable(),

    openedAt: z.string().min(1, "Open date is required"),
    closedAt: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const now = Date.now() + 60_000;
    if (v.openedAt && new Date(v.openedAt).getTime() > now) issue("openedAt", "Can't be in the future");

    if (v.status === "CLOSED") {
      if (v.overridePnl) {
        if (!SIGNED_DEC.test(v.manualNetPnl)) issue("manualNetPnl", "Enter the net P&L, e.g. -25.50");
      } else if (!v.exitPrice) {
        issue("exitPrice", "Exit price is required for a closed trade");
      }
      if (!v.closedAt) issue("closedAt", "Close date is required");
      else {
        if (v.openedAt && new Date(v.closedAt) < new Date(v.openedAt)) issue("closedAt", "Must be after the open date");
        if (new Date(v.closedAt).getTime() > now) issue("closedAt", "Can't be in the future");
      }
    }
    if (v.riskType && !v.riskValue) issue("riskValue", "Enter the risk value");
    if (!v.riskType && v.riskValue) issue("riskType", "Pick $ or %");
    if (v.riskType === "PERCENT" && Number(v.riskValue) > 100) issue("riskValue", "Max 100%");
    if (v.targetHit && v.slHit) issue("slHit", "Can't hit both target and stop loss");
  });

export type TradeFormValues = z.infer<typeof tradeFormSchema>;

/** ISO → value for <input type="datetime-local"> in the user's local time */
export function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export const nowLocalInput = () => isoToLocalInput(new Date().toISOString());

export function emptyTradeForm(accountId = "", marketType: TradeFormValues["marketType"] = "FUTURES"): TradeFormValues {
  const now = nowLocalInput();
  return {
    accountId,
    symbol: "",
    direction: "LONG",
    marketType,
    status: "CLOSED",
    entryPrice: "",
    exitPrice: "",
    quantity: "",
    contractSize: "",
    leverage: "",
    fees: "",
    stopLoss: "",
    takeProfit: "",
    riskType: "",
    riskValue: "",
    result: "AUTO",
    targetHit: false,
    slHit: false,
    overridePnl: false,
    manualNetPnl: "",
    emotionBefore: "",
    emotionAfter: "",
    setup: "",
    strategy: "",
    timeframe: "",
    mistakes: "",
    notes: "",
    tags: [],
    screenshotPath: null,
    openedAt: now,
    closedAt: now,
  };
}

export function tradeToForm(t: Trade): TradeFormValues {
  return {
    accountId: t.accountId,
    symbol: t.symbol,
    direction: t.direction,
    marketType: t.marketType,
    status: t.status,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice ?? "",
    quantity: t.quantity,
    contractSize: t.contractSize ?? "",
    leverage: t.leverage ?? "",
    fees: t.fees === "0" ? "" : t.fees,
    stopLoss: t.stopLoss ?? "",
    takeProfit: t.takeProfit ?? "",
    riskType: t.riskType ?? "",
    riskValue: t.riskValue ?? "",
    result: t.resultOverridden && t.result ? t.result : "AUTO",
    targetHit: t.targetHit,
    slHit: t.slHit,
    overridePnl: t.pnlOverridden,
    manualNetPnl: t.pnlOverridden ? (t.netPnl ?? "") : "",
    emotionBefore: t.emotionBefore ?? "",
    emotionAfter: t.emotionAfter ?? "",
    setup: t.setup ?? "",
    strategy: t.strategy ?? "",
    timeframe: t.timeframe ?? "",
    mistakes: t.mistakes ?? "",
    notes: t.notes ?? "",
    tags: t.tags,
    screenshotPath: t.screenshotPath,
    openedAt: isoToLocalInput(t.openedAt),
    closedAt: isoToLocalInput(t.closedAt) || nowLocalInput(),
  };
}

/** Form values → API body (without accountId). Empty strings become null. */
export function formToPayload(v: TradeFormValues) {
  const n = (s: string) => (s.trim() === "" ? null : s.trim());
  const closed = v.status === "CLOSED";
  return {
    symbol: v.symbol.trim().toUpperCase(),
    direction: v.direction,
    marketType: v.marketType,
    status: v.status,
    entryPrice: v.entryPrice.trim(),
    exitPrice: closed ? n(v.exitPrice) : null,
    quantity: v.quantity.trim(),
    contractSize: n(v.contractSize),
    leverage: n(v.leverage),
    fees: n(v.fees) ?? "0",
    stopLoss: n(v.stopLoss),
    takeProfit: n(v.takeProfit),
    riskType: v.riskType || null,
    riskValue: v.riskType ? n(v.riskValue) : null,
    result: closed && v.result !== "AUTO" ? v.result : null,
    targetHit: closed && v.targetHit,
    slHit: closed && v.slHit,
    manualNetPnl: closed && v.overridePnl ? n(v.manualNetPnl) : null,
    emotionBefore: v.emotionBefore || null,
    emotionAfter: v.emotionAfter || null,
    setup: n(v.setup),
    strategy: n(v.strategy),
    timeframe: n(v.timeframe),
    mistakes: n(v.mistakes),
    notes: n(v.notes),
    tags: v.tags,
    screenshotPath: v.screenshotPath,
    openedAt: new Date(v.openedAt).toISOString(),
    closedAt: closed && v.closedAt ? new Date(v.closedAt).toISOString() : null,
  };
}

export type TradePayload = ReturnType<typeof formToPayload>;
