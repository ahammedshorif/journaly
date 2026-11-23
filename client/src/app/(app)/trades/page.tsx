"use client";

import { CandlestickChart, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { EmptyState } from "@/components/empty-state";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/pagination";
import { TradeFilters } from "@/components/trades/trade-filters";
import { TradesTable, TradesTableSkeleton } from "@/components/trades/trades-table";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/use-accounts";
import { useTradeFilters } from "@/hooks/use-trade-filters";
import { useTrades } from "@/hooks/use-trades";
import { errorMessage } from "@/lib/api-client";
import { formatMoney, formatPercent, pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TradesPage() {
  return (
    <Suspense fallback={<TradesTableSkeleton />}>
      <TradesView />
    </Suspense>
  );
}

function TradesView() {
  const { filters, setFilters, reset, activeCount } = useTradeFilters({ pageSize: 20 });
  const { data, isPending: isLoading, isFetching, isError, error, refetch } = useTrades(filters);
  const { data: accounts = [] } = useAccounts("all");

  // P&L totals can only be shown in a currency when every trade shares one.
  const summaryCurrency = useMemo(() => {
    if (filters.accountId) return accounts.find((a) => a.id === filters.accountId)?.currency ?? null;
    const set = new Set(accounts.map((a) => a.currency));
    return set.size === 1 ? [...set][0]! : null;
  }, [accounts, filters.accountId]);

  const newHref = filters.accountId ? `/trades/new?accountId=${filters.accountId}` : "/trades/new";

  return (
    <>
      <PageHeader
        title="Trades"
        description="Every trade across your accounts. Filters stay in the URL, so you can bookmark a view."
        actions={
          <>
            <ExportMenu type="trades" params={{ ...filters, page: undefined, pageSize: undefined }} />
            <Button asChild>
              <Link href={newHref}>
                <Plus /> Add trade
              </Link>
            </Button>
          </>
        }
      />

      <TradeFilters filters={filters} onChange={setFilters} onReset={reset} activeCount={activeCount} />

      {data && data.total > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Trades </span>
            <strong className="tabular-nums">{data.total}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Net P&amp;L </span>
            <strong className={cn("tabular-nums", pnlClass(data.summary.netPnl))}>
              {summaryCurrency
                ? formatMoney(data.summary.netPnl, summaryCurrency, { signed: true })
                : `${Number(data.summary.netPnl) > 0 ? "+" : ""}${Number(data.summary.netPnl).toFixed(2)} (mixed currencies)`}
            </strong>
          </span>
          <span>
            <span className="text-muted-foreground">Win rate </span>
            <strong className="tabular-nums">{formatPercent(data.summary.winRate)}</strong>
            <span className="text-muted-foreground">
              {" "}
              ({data.summary.wins}W / {data.summary.losses}L / {data.summary.breakevens}BE)
            </span>
          </span>
        </div>
      )}

      {isLoading ? (
        <TradesTableSkeleton />
      ) : isError ? (
        <EmptyState
          icon={CandlestickChart}
          title="Couldn't load trades"
          description={errorMessage(error)}
          action={<Button variant="outline" onClick={() => void refetch()}>Try again</Button>}
        />
      ) : !data?.items.length ? (
        activeCount > 0 ? (
          <EmptyState
            icon={CandlestickChart}
            title="No trades match these filters"
            action={<Button variant="outline" onClick={reset}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={CandlestickChart}
            title="No trades yet"
            description="Log your first trade: entry, exit, risk, emotions and lessons. P&L and balance update automatically."
            action={
              <Button asChild>
                <Link href={newHref}>
                  <Plus /> Add trade
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <TradesTable trades={data.items} showAccount={!filters.accountId} dimmed={isFetching} />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={(page) => setFilters({ page })}
          />
        </>
      )}
    </>
  );
}
