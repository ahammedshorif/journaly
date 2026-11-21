"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_LABEL } from "@/lib/constants";
import { formatMoney, formatPercent, pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JournalAccount } from "@/types/api";
import { AccountActionsMenu } from "./account-actions-menu";

export function AccountCard({ account }: { account: JournalAccount }) {
  const { stats, currency } = account;

  return (
    <Card className={cn("group relative transition-shadow hover:shadow-md", account.isArchived && "opacity-75")}>
      {/* Full-card link sits under the action menu */}
      <Link href={`/accounts/${account.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={`Open ${account.name}`} />

      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{account.name}</h3>
            {account.isArchived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {PLATFORM_LABEL[account.platform]} · {currency}
          </p>
        </div>
        <div className="relative z-10 -mr-2 -mt-1">
          <AccountActionsMenu account={account} />
        </div>
      </div>

      <div className="px-5">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className="text-2xl font-semibold tabular-nums">{formatMoney(stats.currentBalance, currency)}</p>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t px-5 py-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Total P&amp;L</dt>
          <dd className={cn("font-medium tabular-nums", pnlClass(stats.totalPnl))}>
            {formatMoney(stats.totalPnl, currency, { signed: true })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">ROI</dt>
          <dd className={cn("font-medium tabular-nums", pnlClass(stats.roiPercent))}>
            {formatPercent(stats.roiPercent, { signed: true })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Win rate</dt>
          <dd className="font-medium tabular-nums">{formatPercent(stats.winRate)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function AccountCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
      <Skeleton className="mt-6 h-3 w-24" />
      <Skeleton className="mt-2 h-7 w-36" />
      <div className="mt-6 grid grid-cols-3 gap-3 border-t pt-4">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </Card>
  );
}
