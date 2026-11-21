import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EMOTION_META, RESULT_META } from "@/lib/constants";
import { formatMoney, pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Direction, Emotion, TradeResult, TradeStatus } from "@/types/api";

export function DirectionBadge({ direction }: { direction: Direction }) {
  const long = direction === "LONG";
  return (
    <Badge variant={long ? "profit" : "loss"} className="gap-0.5">
      {long ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {long ? "Long" : "Short"}
    </Badge>
  );
}

export function ResultBadge({ result, status }: { result: TradeResult | null; status: TradeStatus }) {
  if (status === "OPEN") return <Badge variant="default">Open</Badge>;
  if (!result) return <Badge variant="secondary">—</Badge>;
  const meta = RESULT_META[result];
  return (
    <Badge variant={result === "PROFIT" ? "profit" : result === "LOSS" ? "loss" : "secondary"}>
      {meta.emoji} {meta.label}
    </Badge>
  );
}

export function EmotionChip({ emotion }: { emotion: Emotion | null }) {
  if (!emotion) return <span className="text-muted-foreground">—</span>;
  const e = EMOTION_META[emotion];
  return (
    <span className="whitespace-nowrap text-sm">
      {e.emoji} {e.label}
    </span>
  );
}

export function PnlText({ value, currency, className }: { value: string | null; currency: string; className?: string }) {
  if (value === null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("font-semibold tabular-nums", pnlClass(value), className)}>
      {formatMoney(value, currency, { signed: true })}
    </span>
  );
}
