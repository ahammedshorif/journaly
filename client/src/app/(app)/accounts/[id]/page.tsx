"use client";

import { ArrowDownLeft, ArrowLeft, ArrowUpRight, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AccountActionsMenu } from "@/components/accounts/account-actions-menu";
import { RecentTrades } from "@/components/accounts/recent-trades";
import { TransactionFormDialog } from "@/components/accounts/transaction-form-dialog";
import { TransactionsList } from "@/components/accounts/transactions-list";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/hooks/use-accounts";
import { ApiError } from "@/lib/api-client";
import { PLATFORM_LABEL } from "@/lib/constants";
import { formatDate, formatMoney, formatPercent, pnlClass } from "@/lib/format";
import type { TransactionType } from "@/types/api";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: account, isPending: isLoading, error } = useAccount(id);
  const [txType, setTxType] = useState<TransactionType | null>(null);

  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return (
      <EmptyState
        icon={SearchX}
        title="Account not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/accounts">Back to accounts</Link>
          </Button>
        }
      />
    );
  }

  const s = account?.stats;
  const cur = account?.currency ?? "USD";

  return (
    <>
      <Link href="/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Accounts
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {isLoading || !account ? (
            <>
              <Skeleton className="h-8 w-56" />
              <Skeleton className="mt-2 h-4 w-40" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{account.name}</h1>
                {account.isArchived && <Badge variant="secondary">Archived</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {PLATFORM_LABEL[account.platform]} · {account.currency} · since {formatDate(account.createdAt)}
              </p>
            </>
          )}
        </div>

        {account && (
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={account.isArchived} onClick={() => setTxType("WITHDRAWAL")}>
              <ArrowUpRight /> Withdraw
            </Button>
            <Button disabled={account.isArchived} onClick={() => setTxType("DEPOSIT")}>
              <ArrowDownLeft /> Deposit
            </Button>
            <AccountActionsMenu account={account} triggerVariant="outline" onDeleted={() => router.replace("/accounts")} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Current balance" loading={isLoading} value={formatMoney(s?.currentBalance, cur)} sub={s && `Initial ${formatMoney(account?.initialBalance, cur)}`} />
        <StatCard
          label="Total P&L"
          loading={isLoading}
          value={formatMoney(s?.totalPnl, cur, { signed: true })}
          valueClassName={pnlClass(s?.totalPnl)}
          sub={s && `${s.closedTrades} closed trade${s.closedTrades === 1 ? "" : "s"}`}
        />
        <StatCard
          label="ROI"
          loading={isLoading}
          value={formatPercent(s?.roiPercent, { signed: true })}
          valueClassName={pnlClass(s?.roiPercent)}
          sub={s && `on ${formatMoney(s.investedCapital, cur)} invested`}
        />
        <StatCard
          label="Win rate"
          loading={isLoading}
          value={formatPercent(s?.winRate)}
          sub={s && `${s.wins}W · ${s.losses}L · ${s.breakevens}BE`}
        />
      </div>

      {account && (
        <div className="mt-6">
          <RecentTrades accountId={account.id} archived={account.isArchived} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Deposits &amp; withdrawals</CardTitle>
            <CardDescription>
              Net deposits: {s ? formatMoney(s.netDeposits, cur, { signed: true }) : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>{account && <TransactionsList accountId={account.id} currency={cur} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16" />
            ) : account?.notes ? (
              <p className="whitespace-pre-wrap text-sm">{account.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes. Use Edit to add rules or reminders for this account.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {account && txType && (
        <TransactionFormDialog open={!!txType} onOpenChange={(o) => !o && setTxType(null)} account={account} type={txType} />
      )}
    </>
  );
}
