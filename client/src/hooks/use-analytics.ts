"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { AccountComparison, AnalyticsReport, DashboardSummary, EquityCurve, Period } from "@/types/api";

export interface RangeParams {
  accountId?: string;
  from?: string;
  to?: string;
}

export function useDashboardSummary(accountId?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.summary(accountId),
    queryFn: () => api.get<DashboardSummary>("/analytics/summary", { query: { accountId } }),
    placeholderData: keepPreviousData,
  });
}

export function useEquityCurve(params: RangeParams) {
  return useQuery({
    queryKey: queryKeys.analytics.equity(params),
    queryFn: () => api.get<EquityCurve>("/analytics/equity-curve", { query: { ...params } }),
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsReport(params: RangeParams & { period: Period }) {
  return useQuery({
    queryKey: queryKeys.analytics.breakdown(params),
    queryFn: () => api.get<AnalyticsReport>("/analytics/breakdown", { query: { ...params } }),
    placeholderData: keepPreviousData,
  });
}

export function useAccountComparison(params: Omit<RangeParams, "accountId">) {
  return useQuery({
    queryKey: queryKeys.analytics.compare(params),
    queryFn: () => api.get<AccountComparison[]>("/analytics/compare", { query: { ...params } }),
    placeholderData: keepPreviousData,
  });
}
