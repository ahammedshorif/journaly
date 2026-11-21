"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { removeScreenshot } from "@/lib/screenshots";
import type { TradePayload } from "@/lib/validations/trade";
import type { Direction, Emotion, MarketType, Trade, TradeList, TradeMeta, TradeResult, TradeStatus } from "@/types/api";

export interface TradeFilters {
  accountId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "openedAt" | "closedAt" | "netPnl" | "symbol" | "createdAt";
  sortDir?: "asc" | "desc";
  from?: string;
  to?: string;
  symbol?: string;
  result?: TradeResult;
  status?: TradeStatus;
  direction?: Direction;
  marketType?: MarketType;
  emotion?: Emotion;
  strategy?: string;
  tag?: string;
  q?: string;
}

export function useTrades(filters: TradeFilters) {
  return useQuery({
    queryKey: queryKeys.trades.list(filters),
    queryFn: ({ signal }) => api.get<TradeList>("/trades", { query: { ...filters }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useTrade(id: string) {
  return useQuery({
    queryKey: queryKeys.trades.detail(id),
    queryFn: () => api.get<Trade>(`/trades/${id}`),
    enabled: Boolean(id),
  });
}

export function useTradeMeta() {
  return useQuery({ queryKey: queryKeys.trades.meta, queryFn: () => api.get<TradeMeta>("/trades/meta"), staleTime: 5 * 60_000 });
}

/** Trades change balances → refresh trades, accounts and meta together. */
function useInvalidateTrading() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
      qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
    ]);
}

export function useCreateTrade() {
  const invalidate = useInvalidateTrading();
  return useMutation({
    mutationFn: ({ accountId, ...payload }: TradePayload & { accountId: string }) =>
      api.post<Trade>(`/accounts/${accountId}/trades`, payload),
    onSuccess: (t) => {
      toast.success(`${t.symbol} trade saved`);
      return invalidate();
    },
  });
}

export function useUpdateTrade(id: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateTrading();
  return useMutation({
    mutationFn: (payload: TradePayload) => api.patch<Trade>(`/trades/${id}`, payload),
    onSuccess: (t) => {
      qc.setQueryData(queryKeys.trades.detail(id), t);
      toast.success("Trade updated");
      return invalidate();
    },
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTrading();
  return useMutation({
    mutationFn: async (trade: Pick<Trade, "id" | "screenshotPath">) => {
      await api.delete(`/trades/${trade.id}`);
      if (trade.screenshotPath) await removeScreenshot(trade.screenshotPath); // best effort
    },
    onSuccess: (_d, trade) => {
      qc.removeQueries({ queryKey: queryKeys.trades.detail(trade.id) });
      toast.success("Trade deleted");
      return invalidate();
    },
  });
}
