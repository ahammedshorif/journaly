import { fmtAmount } from "@/components/charts/chart-utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Metrics } from "@/types/api";

interface Tile {
  label: string;
  value: string;
  sub?: string;
  tone?: string | number | null; // colour by sign
  hint?: string;
}

export function MetricsGrid({ m, currency, loading }: { m?: Metrics; currency: string | null; loading?: boolean }) {
  if (loading || !m) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 16 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }
  const money = (v: string | null, signed = true) => (v === null ? "—" : fmtAmount(v, currency, { signed }));
  const pct = (v: string | null) => (v === null ? "—" : `${Number(v) > 0 ? "+" : ""}${v}%`);

  const tiles: Tile[] = [
    { label: "Net P&L", value: money(m.netPnl), tone: m.netPnl, sub: `Fees ${money(m.totalFees, false)}` },
    { label: "ROI", value: pct(m.roiPercent), tone: m.roiPercent, hint: "Net P&L ÷ (balance at start + net deposits)" },
    { label: "Win rate", value: m.winRate ? `${m.winRate}%` : "—", sub: "Breakevens excluded" },
    { label: "Total trades", value: String(m.totalTrades), sub: `${m.wins}W · ${m.losses}L · ${m.breakevens}BE` },
    { label: "Avg win", value: money(m.avgWin), tone: m.avgWin },
    { label: "Avg loss", value: money(m.avgLoss), tone: m.avgLoss },
    { label: "Largest win", value: money(m.largestWin), tone: m.largestWin },
    { label: "Largest loss", value: money(m.largestLoss), tone: m.largestLoss },
    { label: "Profit factor", value: m.profitFactor ?? "—", hint: "Gross profit ÷ gross loss (>1 is profitable)", sub: m.profitFactor ? (Number(m.profitFactor) >= 1 ? "Profitable" : "Losing") : undefined },
    { label: "Expectancy", value: money(m.expectancy), tone: m.expectancy, sub: "Per trade" },
    { label: "Avg R:R", value: m.avgRiskReward ? `1:${m.avgRiskReward}` : "—", sub: "Planned" },
    { label: "Avg R multiple", value: m.avgRMultiple ? `${m.avgRMultiple}R` : "—", tone: m.avgRMultiple, sub: "Realised" },
    { label: "Max drawdown", value: money(m.maxDrawdown, false), sub: m.maxDrawdownPercent ? `${m.maxDrawdownPercent}% from peak` : undefined, tone: Number(m.maxDrawdown) > 0 ? -1 : 0 },
    { label: "Gross profit", value: money(m.grossProfit, false) },
    { label: "Win streak", value: String(m.longestWinStreak), sub: "Longest" },
    { label: "Loss streak", value: String(m.longestLossStreak), sub: "Longest" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {tiles.map((t) => (
        <Card key={t.label} className="p-3" title={t.hint}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.label}</p>
          <p className={cn("mt-1 whitespace-nowrap text-lg font-semibold tabular-nums tracking-tight xl:text-[15px] 2xl:text-lg", t.tone !== undefined && pnlClass(t.tone))}>{t.value}</p>
          {t.sub && <p className="truncate text-[11px] text-muted-foreground">{t.sub}</p>}
        </Card>
      ))}
    </div>
  );
}
