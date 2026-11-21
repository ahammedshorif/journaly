import type { Direction, Emotion, MarketType, Platform, TradeResult } from "@/types/api";

export const MARKET_TYPES: { value: MarketType; label: string }[] = [
  { value: "SPOT", label: "Spot" },
  { value: "FUTURES", label: "Futures" },
  { value: "FOREX", label: "Forex" },
  { value: "GOLD", label: "Gold" },
  { value: "OTHER", label: "Other" },
];
export const MARKET_LABEL = Object.fromEntries(MARKET_TYPES.map((m) => [m.value, m.label])) as Record<MarketType, string>;

/** Must match server/src/domain/trade-calc.ts */
export const DEFAULT_CONTRACT_SIZE: Record<MarketType, number> = {
  SPOT: 1,
  FUTURES: 1,
  FOREX: 100_000,
  GOLD: 100,
  OTHER: 1,
};

export const DIRECTION_LABEL: Record<Direction, string> = { LONG: "Long", SHORT: "Short" };

export const RESULT_META: Record<TradeResult, { label: string; emoji: string }> = {
  PROFIT: { label: "Profit", emoji: "✅" },
  LOSS: { label: "Loss", emoji: "❌" },
  BREAKEVEN: { label: "Breakeven", emoji: "➖" },
};

export const EMOTIONS: { value: Emotion; label: string; emoji: string }[] = [
  { value: "CONFIDENT", label: "Confident", emoji: "💪" },
  { value: "CALM", label: "Calm", emoji: "😌" },
  { value: "NEUTRAL", label: "Neutral", emoji: "😐" },
  { value: "EXCITED", label: "Excited", emoji: "🤩" },
  { value: "FEAR", label: "Fear", emoji: "😨" },
  { value: "GREED", label: "Greed", emoji: "🤑" },
  { value: "FOMO", label: "FOMO", emoji: "🏃" },
  { value: "REVENGE", label: "Revenge", emoji: "😡" },
  { value: "ANXIOUS", label: "Anxious", emoji: "😰" },
  { value: "BORED", label: "Bored", emoji: "🥱" },
  { value: "FRUSTRATED", label: "Frustrated", emoji: "😤" },
  { value: "IMPATIENT", label: "Impatient", emoji: "⏳" },
];
export const EMOTION_META = Object.fromEntries(EMOTIONS.map((e) => [e.value, e])) as Record<
  Emotion,
  (typeof EMOTIONS)[number]
>;

export const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1D", "1W"] as const;

/** Sensible market type for a new trade on an account of this platform. */
export const PLATFORM_DEFAULT_MARKET: Record<Platform, MarketType> = {
  BINANCE: "FUTURES",
  BYBIT: "FUTURES",
  FOREX: "FOREX",
  GOLD: "GOLD",
  OTHER: "OTHER",
};

export const SCREENSHOT_BUCKET = "trade-screenshots";

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "BINANCE", label: "Binance" },
  { value: "BYBIT", label: "Bybit" },
  { value: "FOREX", label: "Forex" },
  { value: "GOLD", label: "Gold" },
  { value: "OTHER", label: "Other" },
];

export const PLATFORM_LABEL: Record<Platform, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.value, p.label]),
) as Record<Platform, string>;

export const CURRENCIES = ["USD", "USDT", "USDC", "EUR", "GBP", "JPY", "BDT", "INR", "AUD", "CAD"] as const;
