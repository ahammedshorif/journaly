"use client";

import { CandlestickChart, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { TradesTable, TradesTableSkeleton } from "@/components/trades/trades-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrades } from "@/hooks/use-trades";

export function RecentTrades({ accountId, archived }: { accountId: string; archived: boolean }) {
  const { data, isLoading } = useTrades({ accountId, pageSize: 5, sortBy: "openedAt", sortDir: "desc" });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent trades</CardTitle>
        <div className="flex gap-2">
          {!!data?.total && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/trades?accountId=${accountId}`}>View all ({data.total})</Link>
            </Button>
          )}
          {!archived && (
            <Button size="sm" asChild>
              <Link href={`/trades/new?accountId=${accountId}`}>
                <Plus /> Add trade
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TradesTableSkeleton rows={3} />
        ) : !data?.items.length ? (
          <EmptyState icon={CandlestickChart} title="No trades in this account yet" className="py-10" />
        ) : (
          <TradesTable trades={data.items} showAccount={false} />
        )}
      </CardContent>
    </Card>
  );
}
