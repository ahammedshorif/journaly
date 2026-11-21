"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { TradeFilters } from "@/hooks/use-trades";

const KEYS = [
  "accountId",
  "sortBy",
  "sortDir",
  "from",
  "to",
  "symbol",
  "result",
  "status",
  "direction",
  "marketType",
  "emotion",
  "strategy",
  "tag",
  "q",
] as const;

/** Trade filters stored in the URL (?result=LOSS&emotion=FOMO…) so views are shareable and survive refresh. */
export function useTradeFilters(defaults: Partial<TradeFilters> = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<TradeFilters>(() => {
    const f: Record<string, string | number> = { ...defaults };
    for (const k of KEYS) {
      const val = params.get(k);
      if (val) f[k] = val;
    }
    f.page = Math.max(1, Number(params.get("page")) || 1);
    return f as TradeFilters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<TradeFilters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, val] of Object.entries(patch)) {
        if (val === undefined || val === null || val === "") next.delete(k);
        else next.set(k, String(val));
      }
      if (!("page" in patch)) next.delete("page"); // any filter change → back to page 1
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  const activeCount = KEYS.filter((k) => k !== "sortBy" && k !== "sortDir" && params.get(k)).length;

  return { filters, setFilters, reset, activeCount };
}
