"use client";

import { ArrowRight, Plus, Target, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AccountSwitcher } from "@/components/account-switcher";
import { ChartCard } from "@/components/charts/chart-card";
import { fmtAmount } from "@/components/charts/chart-utils";
import { EquityChart } from "@/components/charts/equity-chart";
import { EmptyState } from "@/components/empty-state";
import { GoalProgressBar } from "@/components/goals/goal-progress";
import { RiskWarnings } from "@/components/goals/risk-warnings";
import { StatCard } from "@/components/stat-card";
import { TradesTable, TradesTableSkeleton } from "@/components/trades/trades-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-accounts";
import { useDashboardSummary, useEquityCurve } from "@/hooks/use-analytics";
import { useGoals } from "@/hooks/use-goals";
import { useMe } from "@/hooks/use-me";
import { useTrades } from "@/hooks/use-trades";
import { formatPercent, pnlClass } from "@/lib/format";

type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";
const RANGE_DAYS: Record<Range, number | null> = { "1M": 30, "3M": 90, "6M": 182, "1Y": 365, ALL: null };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const accountId = params.get("account") ?? undefined;
  const setAccount = (id?: string) => router.replace(id ? `${pathname}?account=${id}` : pathname, { scroll: false });

  const [range, setRange] = useState<Range>("3M");
  const from = useMemo(() => {
    const days = RANGE_DAYS[range];
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined;
  }, [range]);

  const { data: me } = useMe();
  const { data: accounts, isPending: accountsLoading } = useAccounts("active");
  const { data: s, isPending: isLoading } = useDashboardSummary(accountId);
  const { data: curve, isPending: curveLoading } = useEquityCurve({ accountId, from });
  const { data: recent, isPending: recentLoading } = useTrades({ accountId, pageSize: 5, sortBy: "openedAt", sortDir: "desc" });
  const { data: goals } = useGoals();

  const cur = s?.currency ?? null;
  const firstName = me?.name?.split(" ")[0];
  const addHref = accountId ? `/trades/new?accountId=${accountId}` : "/trades/new";
  const scopedGoals = (goals?.goals ?? []).filter((g) => !accountId || g.accountId === accountId || g.accountId === null);

  if (!accountsLoading && !accounts?.length) {
    return (
      <>
        <h1 className="mb-6 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <EmptyState
          icon={Wallet}
          title="Start by creating an account"
          description="Add your exchange or broker account with its starting balance, then log your trades. The dashboard fills in automatically."
          action={
            <Button asChild>
              <Link href="/accounts">Create an account</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{firstName ? `Hi, ${firstName}` : "Dashboard"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {s?.timezone ? `Days and weeks in ${s.timezone.replace(/_/g, " ")}` : "Your trading at a glance"}
          </p>
        </div>
        <div className="flex gap-2">
          <AccountSwitcher value={accountId} onChange={setAccount} />
          <Button asChild className="hidden sm:inline-flex">
            <Link href={addHref}>
              <Plus /> Add trade
            </Link>
          </Button>
        </div>
      </div>

      <RiskWarnings className="mb-5" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total balance"
          loading={isLoading}
          value={s?.mixedCurrencies ? `${s.balances.length} currencies` : fmtAmount(s?.totalBalance, cur)}
          sub={
            s?.mixedCurrencies ? (
              <span className="grid">
                {s.balances.map((b) => (
                  <span key={b.currency}>{fmtAmount(b.balance, b.currency)}</span>
                ))}
              </span>
            ) : (
              s && <span className={pnlClass(s.totalPnl)}>{fmtAmount(s.totalPnl, cur, { signed: true })} all-time P&amp;L</span>
            )
          }
        />
        <StatCard label="Today" loading={isLoading} value={fmtAmount(s?.pnl.today, cur, { signed: true })} valueClassName={pnlClass(s?.pnl.today)} sub="Net P&L" />
        <StatCard label="This week" loading={isLoading} value={fmtAmount(s?.pnl.week, cur, { signed: true })} valueClassName={pnlClass(s?.pnl.week)} sub="Since Monday" />
        <StatCard label="This month" loading={isLoading} value={fmtAmount(s?.pnl.month, cur, { signed: true })} valueClassName={pnlClass(s?.pnl.month)} sub="Month to date" />
        <StatCard label="Win rate" loading={isLoading} value={formatPercent(s?.winRate)} sub={s && `${s.wins}W · ${s.losses}L of ${s.closedTrades}`} />
        <StatCard
          label="Open trades"
          loading={isLoading}
          value={s?.openTrades ?? 0}
          sub={
            s?.openTrades ? (
              <Link className="underline-offset-2 hover:underline" href={`/trades?status=OPEN${accountId ? `&accountId=${accountId}` : ""}`}>
                View open positions
              </Link>
            ) : (
              "No running positions"
            )
          }
        />
      </div>
      {s?.mixedCurrencies && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your accounts use different currencies, so P&amp;L totals add up raw amounts. Pick a single account for exact figures.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Equity curve"
          description="Balance after each closed trade, including deposits and withdrawals"
          loading={curveLoading}
          empty={!curve?.points.length}
          emptyText="Close a trade to start your equity curve."
          height={280}
          actions={
            <Segmented
              ariaLabel="Equity curve range"
              size="sm"
              className="w-auto"
              value={range}
              onChange={setRange}
              options={(Object.keys(RANGE_DAYS) as Range[]).map((r) => ({ value: r, label: r === "ALL" ? "All" : r }))}
            />
          }
          table={
            curve && {
              columns: [{ label: "Date" }, { label: "Balance", align: "right" }, { label: "Cumulative P&L", align: "right" }],
              rows: curve.points.map((p) => [
                new Date(p.time).toLocaleString(),
                fmtAmount(p.balance, curve.currency),
                fmtAmount(p.cumulativePnl, curve.currency, { signed: true }),
              ]),
            }
          }
        >
          {curve && <EquityChart points={curve.points} currency={curve.currency} />}
        </ChartCard>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Goals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/goals">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-5">
            {scopedGoals.length ? (
              scopedGoals.map((g) => <GoalProgressBar key={g.id} goal={g} />)
            ) : (
              <div className="py-6 text-center">
                <Target className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Set a monthly profit target and a max daily loss to stay disciplined.</p>
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link href="/goals">Set goals</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Recent trades</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={accountId ? `/trades?accountId=${accountId}` : "/trades"}>
              All trades <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <TradesTableSkeleton rows={3} />
          ) : recent?.items.length ? (
            <TradesTable trades={recent.items} showAccount={!accountId} />
          ) : (
            <EmptyState
              icon={Plus}
              title="No trades yet"
              className="py-10"
              action={
                <Button asChild>
                  <Link href={addHref}>Add your first trade</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Quick add on mobile */}
      <Link
        href={addHref}
        aria-label="Add trade"
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover sm:hidden"
      >
        <Plus className="size-6" />
      </Link>
    </>
  );
}
