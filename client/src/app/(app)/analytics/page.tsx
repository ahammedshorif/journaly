"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AccountSwitcher } from "@/components/account-switcher";
import { CompareAccounts } from "@/components/analytics/compare-accounts";
import { EmotionAnalysis } from "@/components/analytics/emotion-analysis";
import { MetricsGrid } from "@/components/analytics/metrics-grid";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { ChartCard, type TableView } from "@/components/charts/chart-card";
import { fmtAmount } from "@/components/charts/chart-utils";
import { EquityChart } from "@/components/charts/equity-chart";
import { PnlBarChart } from "@/components/charts/pnl-bar-chart";
import { WinLossDonut } from "@/components/charts/win-loss-donut";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountComparison, useAnalyticsReport } from "@/hooks/use-analytics";
import type { Bucket, Period } from "@/types/api";

type Tab = "daily" | "weekly" | "monthly" | "yearly" | "custom";
const TABS: { value: Tab; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "Last 30 days, by day" },
  { value: "weekly", label: "Weekly", hint: "Last 12 weeks, by week" },
  { value: "monthly", label: "Monthly", hint: "Last 12 months, by month" },
  { value: "yearly", label: "Yearly", hint: "All time, by year" },
  { value: "custom", label: "Custom", hint: "Pick a date range" },
];

const localDay = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const dayStartIso = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const dayEndIso = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

function rangeFor(tab: Tab, customFrom?: string, customTo?: string, customPeriod?: Period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (tab) {
    case "daily":
      return { period: "daily" as Period, from: new Date(today.getTime() - 29 * 86_400_000).toISOString() };
    case "weekly": {
      const monday = new Date(today);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 11 * 7);
      return { period: "weekly" as Period, from: monday.toISOString() };
    }
    case "monthly":
      return { period: "monthly" as Period, from: new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString() };
    case "yearly":
      return { period: "yearly" as Period, from: undefined };
    case "custom": {
      const from = customFrom ? dayStartIso(customFrom) : undefined;
      const to = customTo ? dayEndIso(customTo) : undefined;
      const days = from ? ((to ? new Date(to) : now).getTime() - new Date(from).getTime()) / 86_400_000 : Infinity;
      const auto: Period = days <= 45 ? "daily" : days <= 200 ? "weekly" : days <= 800 ? "monthly" : "yearly";
      return { period: customPeriod ?? auto, from, to };
    }
  }
}

const bucketTable = (rows: Bucket[], keyLabel: string, currency: string | null): TableView => ({
  columns: [
    { label: keyLabel },
    { label: "Net P&L", align: "right" },
    { label: "Trades", align: "right" },
    { label: "Win rate", align: "right" },
    { label: "Avg / trade", align: "right" },
  ],
  rows: rows.map((b) => [b.label, fmtAmount(b.netPnl, currency, { signed: true }), b.trades, b.winRate ? `${b.winRate}%` : "—", fmtAmount(b.avgPnl, currency, { signed: true })]),
});

function periodLabel(key: string, period: Period) {
  if (period === "yearly") return key;
  if (period === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, 1)));
  }
  const [y, m, d] = key.split("-").map(Number);
  const s = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, d!)));
  return period === "weekly" ? `Wk ${s}` : s;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Analytics />
    </Suspense>
  );
}

function Analytics() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (params.get("tab") as Tab) || "monthly";
  const accountId = params.get("account") ?? undefined;
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const customPeriod = (params.get("period") as Period) || undefined;

  const setParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const range = useMemo(() => rangeFor(tab, customFrom, customTo, customPeriod), [tab, customFrom, customTo, customPeriod]);
  const { data: r, isPending: isLoading } = useAnalyticsReport({ accountId, period: range.period, from: range.from, to: range.to });
  const { data: compare, isPending: compareLoading } = useAccountComparison({ from: range.from, to: range.to });

  const cur = r?.currency ?? null;
  const periods = useMemo(() => (r?.periods ?? []).map((b) => ({ ...b, label: periodLabel(b.key, range.period) })), [r, range.period]);

  // Heatmap window: the range, capped to the most recent year so it stays readable.
  const heat = useMemo(() => {
    const to = range.to ? localDay(new Date(range.to)) : localDay(new Date());
    const yearAgo = localDay(new Date(new Date(`${to}T00:00:00`).getTime() - 364 * 86_400_000));
    const first = r?.calendar[0]?.date;
    const fromCandidate = range.from ? localDay(new Date(range.from)) : (first ?? yearAgo);
    return { from: fromCandidate < yearAgo ? yearAgo : fromCandidate, to };
  }, [range, r]);

  const empty = !isLoading && (r?.metrics.totalTrades ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description={TABS.find((t) => t.value === tab)?.hint}
        actions={
          <>
            <AccountSwitcher value={accountId} onChange={(id) => setParams({ account: id })} includeArchived />
            <ExportMenu type="analytics" params={{ accountId, from: range.from, to: range.to, period: range.period }} />
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="a-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input id="a-from" type="date" className="h-9 w-40" value={customFrom ?? ""} max={customTo} onChange={(e) => setParams({ from: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="a-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input id="a-to" type="date" className="h-9 w-40" value={customTo ?? ""} min={customFrom} onChange={(e) => setParams({ to: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Group by</Label>
              <Select value={customPeriod ?? "auto"} onValueChange={(v) => setParams({ period: v === "auto" ? undefined : v })}>
                <SelectTrigger className="h-9 w-32" aria-label="Group by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto ({range.period})</SelectItem>
                  <SelectItem value="daily">Day</SelectItem>
                  <SelectItem value="weekly">Week</SelectItem>
                  <SelectItem value="monthly">Month</SelectItem>
                  <SelectItem value="yearly">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {r?.mixedCurrencies && (
        <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          These accounts use different currencies, so amounts are summed as raw numbers. Pick one account for exact money figures.
        </p>
      )}

      <MetricsGrid m={r?.metrics} currency={cur} loading={isLoading} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Equity curve"
          description="Balance after each closed trade in this range"
          loading={isLoading}
          empty={!r?.equityCurve.length}
          height={280}
          table={
            r && {
              columns: [{ label: "Date" }, { label: "Balance", align: "right" }, { label: "Cumulative P&L", align: "right" }],
              rows: r.equityCurve.map((p) => [new Date(p.time).toLocaleString(), fmtAmount(p.balance, cur), fmtAmount(p.cumulativePnl, cur, { signed: true })]),
            }
          }
        >
          {r && <EquityChart points={r.equityCurve} currency={cur} />}
        </ChartCard>
        <ChartCard
          title="Wins vs losses"
          loading={isLoading}
          empty={empty}
          height={280}
          table={
            r && {
              columns: [{ label: "Outcome" }, { label: "Trades", align: "right" }],
              rows: [
                ["Wins", r.metrics.wins],
                ["Losses", r.metrics.losses],
                ["Breakeven", r.metrics.breakevens],
              ],
            }
          }
        >
          {r && <WinLossDonut wins={r.metrics.wins} losses={r.metrics.losses} breakevens={r.metrics.breakevens} winRate={r.metrics.winRate} />}
        </ChartCard>
      </div>

      <ChartCard
        className="mt-6"
        title={`P&L per ${range.period === "daily" ? "day" : range.period.replace("ly", "")}`}
        loading={isLoading}
        empty={!periods.length}
        table={bucketTable(periods, "Period", cur)}
      >
        <PnlBarChart data={periods} currency={cur} />
      </ChartCard>

      <ChartCard
        className="mt-6"
        title="Daily P&L calendar"
        description={r ? `Days in ${r.timezone.replace(/_/g, " ")}` : undefined}
        loading={isLoading}
        empty={!r?.calendar.length}
        height={170}
        table={
          r && {
            columns: [{ label: "Date" }, { label: "Net P&L", align: "right" }, { label: "Trades", align: "right" }],
            rows: r.calendar.map((d) => [d.date, fmtAmount(d.netPnl, cur, { signed: true }), d.trades]),
          }
        }
      >
        {r && <CalendarHeatmap days={r.calendar} from={heat.from} to={heat.to} currency={cur} />}
      </ChartCard>

      <div className="mt-6">
        <EmotionAnalysis before={r?.emotions.before ?? []} after={r?.emotions.after ?? []} currency={cur} loading={isLoading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="P&L by pair"
          loading={isLoading}
          empty={!r?.byPair.length}
          height={Math.max(220, Math.min(12, r?.byPair.length ?? 0) * 30)}
          table={r && bucketTable(r.byPair, "Pair", cur)}
        >
          {r && <PnlBarChart data={r.byPair.slice(0, 12)} currency={cur} layout="horizontal" />}
        </ChartCard>
        <ChartCard
          title="P&L by strategy"
          loading={isLoading}
          empty={!r?.byStrategy.length}
          height={Math.max(220, Math.min(12, r?.byStrategy.length ?? 0) * 30)}
          table={r && bucketTable(r.byStrategy, "Strategy", cur)}
        >
          {r && <PnlBarChart data={r.byStrategy.slice(0, 12)} currency={cur} layout="horizontal" labelWidth={120} />}
        </ChartCard>
        <ChartCard
          title="P&L by day of week"
          description="By close day"
          loading={isLoading}
          empty={empty}
          table={r && bucketTable(r.byWeekday, "Day", cur)}
        >
          {r && <PnlBarChart data={r.byWeekday} currency={cur} />}
        </ChartCard>
        <ChartCard
          title="P&L by hour"
          description="By entry hour — when you click buy/sell"
          loading={isLoading}
          empty={empty}
          table={r && bucketTable(r.byHour.filter((h) => h.trades > 0), "Hour", cur)}
        >
          {r && <PnlBarChart data={r.byHour.map((h) => ({ ...h, label: h.label.slice(0, 2) }))} currency={cur} />}
        </ChartCard>
      </div>

      <h2 className="mb-4 mt-10 font-serif text-xl font-semibold tracking-tight">Compare accounts</h2>
      <CompareAccounts data={compare} loading={compareLoading} />
    </>
  );
}
