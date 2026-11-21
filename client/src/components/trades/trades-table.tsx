"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { formatNumber, formatRR } from "@/lib/trade-calc";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/api";
import { DirectionBadge, EmotionChip, PnlText, ResultBadge } from "./trade-badges";

interface Props {
  trades: Trade[];
  showAccount?: boolean;
  dimmed?: boolean;
}

/** Desktop: table. Mobile: stacked cards. */
export function TradesTable({ trades, showAccount = true, dimmed }: Props) {
  const router = useRouter();

  return (
    <div className={cn("transition-opacity", dimmed && "opacity-60")}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Pair</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Entry → Exit</th>
              <th className="px-4 py-3 text-right font-medium">Size</th>
              <th className="px-4 py-3 text-right font-medium">Net P&amp;L</th>
              <th className="px-4 py-3 text-right font-medium">R:R</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Emotion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trades.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/trades/${t.id}`)}
                className="cursor-pointer transition-colors hover:bg-accent/50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(t.openedAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/trades/${t.id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                    {t.symbol}
                  </Link>
                  {showAccount && <p className="text-xs text-muted-foreground">{t.account.name}</p>}
                </td>
                <td className="px-4 py-3">
                  <DirectionBadge direction={t.direction} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatNumber(t.entryPrice)} → {formatNumber(t.exitPrice)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatNumber(t.quantity)}
                  {t.leverage && <span className="text-xs text-muted-foreground"> ×{Number(t.leverage)}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <PnlText value={t.netPnl} currency={t.account.currency} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatRR(t.riskReward)}</td>
                <td className="px-4 py-3">
                  <ResultBadge result={t.result} status={t.status} />
                </td>
                <td className="px-4 py-3">
                  <EmotionChip emotion={t.emotionBefore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="grid gap-2 md:hidden">
        {trades.map((t) => (
          <li key={t.id}>
            <Link href={`/trades/${t.id}`} className="block rounded-xl border bg-card p-4 transition-colors active:bg-accent">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.symbol}</span>
                    <DirectionBadge direction={t.direction} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(t.openedAt)}
                    {showAccount && ` · ${t.account.name}`}
                  </p>
                </div>
                <div className="text-right">
                  <PnlText value={t.netPnl} currency={t.account.currency} />
                  <div className="mt-1">
                    <ResultBadge result={t.result} status={t.status} />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {formatNumber(t.entryPrice)} → {formatNumber(t.exitPrice)} · size {formatNumber(t.quantity)} · R:R {formatRR(t.riskReward)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TradesTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
