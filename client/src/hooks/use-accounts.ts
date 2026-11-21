"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { queryKeys, type AccountStatusFilter } from "@/lib/query-keys";
import type { AccountFormValues } from "@/lib/validations/account";
import type { JournalAccount } from "@/types/api";

export function useAccounts(status: AccountStatusFilter = "active") {
  return useQuery({
    queryKey: queryKeys.accounts.list(status),
    queryFn: () => api.get<JournalAccount[]>("/accounts", { query: { status } }),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: queryKeys.accounts.detail(id),
    queryFn: () => api.get<JournalAccount>(`/accounts/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidateAccounts() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      qc.invalidateQueries({ queryKey: queryKeys.trades.all }), // initial balance shifts balanceAfter
    ]);
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: AccountFormValues) => api.post<JournalAccount>("/accounts", input),
    onSuccess: (account) => {
      toast.success(`Account "${account.name}" created`);
      return invalidate();
    },
  });
}

export function useUpdateAccount(id: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: Partial<AccountFormValues>) => api.patch<JournalAccount>(`/accounts/${id}`, input),
    onSuccess: () => {
      toast.success("Account updated");
      return invalidate();
    },
  });
}

export function useSetAccountArchived() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.post<JournalAccount>(`/accounts/${id}/${archived ? "archive" : "unarchive"}`),
    onSuccess: (account) => {
      toast.success(account.isArchived ? "Account archived" : "Account restored");
      return invalidate();
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: (_data, id) => {
      toast.success("Account deleted");
      qc.removeQueries({ queryKey: queryKeys.accounts.detail(id) });
      qc.removeQueries({ queryKey: ["transactions", id] });
      return Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
        qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
      ]);
    },
  });
}
