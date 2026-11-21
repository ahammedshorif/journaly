"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { TransactionFormValues } from "@/lib/validations/transaction";
import type { Paginated, Transaction } from "@/types/api";

export function useTransactions(accountId: string, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: queryKeys.transactions.list(accountId, page),
    queryFn: () => api.get<Paginated<Transaction>>(`/accounts/${accountId}/transactions`, { query: { page, pageSize } }),
    placeholderData: keepPreviousData,
    enabled: Boolean(accountId),
  });
}

/** Balance depends on transactions, so every change refreshes account stats and trades' balanceAfter too. */
function useInvalidateMoney() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
    ]);
}

export function useCreateTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: TransactionFormValues & { accountId: string }) =>
      api.post<Transaction>("/transactions", {
        ...input,
        occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : undefined,
      }),
    onSuccess: (tx) => {
      toast.success(tx.type === "DEPOSIT" ? "Deposit recorded" : "Withdrawal recorded");
      return invalidate();
    },
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      toast.success("Transaction deleted");
      return invalidate();
    },
  });
}
