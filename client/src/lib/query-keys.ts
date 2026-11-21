export type AccountStatusFilter = "active" | "archived" | "all";

export const queryKeys = {
  me: ["me"] as const,
  accounts: {
    all: ["accounts"] as const,
    list: (status: AccountStatusFilter) => ["accounts", "list", status] as const,
    detail: (id: string) => ["accounts", "detail", id] as const,
  },
  trades: {
    all: ["trades"] as const,
    list: (filters: object) => ["trades", "list", filters] as const,
    detail: (id: string) => ["trades", "detail", id] as const,
    meta: ["trades", "meta"] as const,
  },
  screenshot: (path: string) => ["screenshot", path] as const,
  analytics: {
    all: ["analytics"] as const,
    summary: (accountId?: string) => ["analytics", "summary", accountId ?? "all"] as const,
    equity: (params: object) => ["analytics", "equity", params] as const,
    breakdown: (params: object) => ["analytics", "breakdown", params] as const,
    compare: (params: object) => ["analytics", "compare", params] as const,
  },
  goals: ["goals"] as const,
  transactions: {
    all: ["transactions"] as const,
    list: (accountId: string, page: number) => ["transactions", accountId, page] as const,
  },
};
