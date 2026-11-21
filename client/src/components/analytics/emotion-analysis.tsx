"use client";

import { Brain } from "lucide-react";
import { useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { fmtAmount } from "@/components/charts/chart-utils";
import { PnlBarChart } from "@/components/charts/pnl-bar-chart";
import { Segmented } from "@/components/ui/segmented";
import { EMOTION_META } from "@/lib/constants";
import { pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Bucket, Emotion } from "@/types/api";

interface Props {
  before: Bucket[];
  after: Bucket[];
  currency: string | null;
  loading?: boolean;
}

const label = (key: string) => {
  const e = EMOTION_META[key as Emotion];
  return e ? `${e.emoji} ${e.label}` : key;
};

/** Win rate & P&L per emotion, costliest first, with a plain-language callout. */
export function EmotionAnalysis({ before, after, currency, loading }: Props) {
  const [which, setWhich] = useState<"before" | "after">("before");
  const rows = (which === "before" ? before : after).map((b) => ({ ...b, label: label(b.key) }));
  const costliest = rows.find((r) => Number(r.netPnl) < 0);
  const best = [...rows].reverse().find((r) => Number(r.netPnl) > 0);

  return (
    <ChartCard
      title="Emotion analysis"
      description={which === "before" ? "How you felt before entering. Which emotions cost you the most?" : "How you felt after closing."}
      loading={loading}
      empty={!rows.length}
      emptyText="Tag emotions on your trades to see how they affect results."
      height={Math.max(220, rows.length * 32)}
      actions={
        <Segmented
          ariaLabel="Emotion timing"
          size="sm"
          className="w-auto"
          value={which}
          onChange={setWhich}
          options={[
            { value: "before", label: "Before" },
            { value: "after", label: "After" },
          ]}
        />
      }
      table={{
        columns: [
          { label: "Emotion" },
          { label: "Trades", align: "right" },
          { label: "Win rate", align: "right" },
          { label: "Net P&L", align: "right" },
          { label: "Avg / trade", align: "right" },
        ],
        rows: rows.map((r) => [r.label, r.trades, r.winRate ? `${r.winRate}%` : "—", fmtAmount(r.netPnl, currency, { signed: true }), fmtAmount(r.avgPnl, currency, { signed: true })]),
      }}
    >
      <div className="grid h-full gap-4 md:grid-cols-[1fr_260px]">
        <PnlBarChart data={rows} currency={currency} layout="horizontal" labelWidth={110} />
        <div className="grid content-start gap-3 text-sm">
          {costliest && (
            <div className="rounded-lg border border-loss/30 bg-loss-soft p-3">
              <p className="flex items-center gap-1.5 font-medium text-loss">
                <Brain className="size-4" /> Costliest: {costliest.label}
              </p>
              <p className="mt-1 text-xs text-foreground">
                {fmtAmount(costliest.netPnl, currency, { signed: true })} over {costliest.trades} trade{costliest.trades === 1 ? "" : "s"}, win rate{" "}
                {costliest.winRate ?? "—"}%.
              </p>
            </div>
          )}
          {best && (
            <div className="rounded-lg border border-profit/30 bg-profit-soft p-3">
              <p className="font-medium text-profit">Best state: {best.label}</p>
              <p className="mt-1 text-xs text-foreground">
                {fmtAmount(best.netPnl, currency, { signed: true })} over {best.trades} trades, win rate {best.winRate ?? "—"}%.
              </p>
            </div>
          )}
          <ul className="divide-y rounded-lg border">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                <span>{r.label}</span>
                <span className="text-muted-foreground">{r.winRate ? `${r.winRate}%` : "—"}</span>
                <span className={cn("font-medium tabular-nums", pnlClass(r.netPnl))}>{fmtAmount(r.netPnl, currency, { signed: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartCard>
  );
}
