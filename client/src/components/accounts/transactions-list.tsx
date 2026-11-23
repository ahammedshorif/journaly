"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteTransaction, useTransactions } from "@/hooks/use-transactions";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/api";

interface Props {
  accountId: string;
  currency: string;
}

export function TransactionsList({ accountId, currency }: Props) {
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const { data, isPending: isLoading, isFetching } = useTransactions(accountId, page);
  const remove = useDeleteTransaction();

  if (isLoading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="No deposits or withdrawals"
        description="Money you add or take out of this account shows up here and adjusts the balance."
        className="py-10"
      />
    );
  }

  return (
    <>
      <ul className={cn("divide-y transition-opacity", isFetching && "opacity-60")}>
        {data.items.map((tx) => {
          const isDeposit = tx.type === "DEPOSIT";
          return (
            <li key={tx.id} className="group flex items-center gap-3 py-3">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  isDeposit ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss",
                )}
              >
                {isDeposit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{isDeposit ? "Deposit" : "Withdrawal"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(tx.occurredAt, true)}
                  {tx.note ? ` · ${tx.note}` : ""}
                </p>
              </div>
              <span className={cn("text-sm font-semibold tabular-nums", isDeposit ? "text-profit" : "text-loss")}>
                {isDeposit ? "+" : "−"}
                {formatMoney(tx.amount, currency)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Delete transaction"
                onClick={() => setToDelete(tx)}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>

      {data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="Delete this transaction?"
        description="The account balance will be recalculated without it."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          await remove.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
      />
    </>
  );
}
