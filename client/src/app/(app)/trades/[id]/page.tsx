"use client";

import { ArrowLeft, Copy, Pencil, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { DirectionBadge, EmotionChip, ResultBadge } from "@/components/trades/trade-badges";
import { ScreenshotImage } from "@/components/trades/screenshot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteTrade, useTrade } from "@/hooks/use-trades";
import { ApiError } from "@/lib/api-client";
import { DEFAULT_CONTRACT_SIZE, MARKET_LABEL } from "@/lib/constants";
import { formatDate, formatMoney, pnlClass } from "@/lib/format";
import { formatNumber, formatRR } from "@/lib/trade-calc";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function duration(from: string, to: string | null) {
  if (!to) return "—";
  const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: t, isLoading, error } = useTrade(id);
  const remove = useDeleteTrade();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return (
      <EmptyState
        icon={SearchX}
        title="Trade not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/trades">Back to trades</Link>
          </Button>
        }
      />
    );
  }

  if (isLoading || !t) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const cur = t.account.currency;
  const rMultiple = t.netPnl && t.riskAmount && Number(t.riskAmount) > 0 ? Number(t.netPnl) / Number(t.riskAmount) : null;

  return (
    <>
      <Link href="/trades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Trades
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{t.symbol}</h1>
            <DirectionBadge direction={t.direction} />
            <ResultBadge result={t.result} status={t.status} />
            {t.targetHit && <Badge variant="profit">🎯 Target hit</Badge>}
            {t.slHit && <Badge variant="loss">🛑 SL hit</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/accounts/${t.accountId}`} className="hover:underline">
              {t.account.name}
            </Link>{" "}
            · {MARKET_LABEL[t.marketType]} · {formatDate(t.openedAt, true)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/trades/${t.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <Button variant="outline" size="icon" aria-label="Delete trade" onClick={() => setConfirmOpen(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Net P&L"
          value={t.netPnl ? formatMoney(t.netPnl, cur, { signed: true }) : "—"}
          valueClassName={pnlClass(t.netPnl)}
          sub={t.pnlOverridden ? "Manually entered" : t.grossPnl ? `Gross ${formatMoney(t.grossPnl, cur, { signed: true })}` : undefined}
        />
        <StatCard label="R multiple" value={rMultiple !== null ? `${rMultiple.toFixed(2)}R` : "—"} valueClassName={pnlClass(rMultiple)} sub={`Planned R:R ${formatRR(t.riskReward)}`} />
        <StatCard label="Risk" value={t.riskAmount ? formatMoney(t.riskAmount, cur) : "—"} sub={t.riskType === "PERCENT" ? `${Number(t.riskValue)}% of balance` : t.riskType === "AMOUNT" ? "Fixed amount" : t.riskAmount ? "From stop loss" : undefined} />
        <StatCard label="Balance after" value={t.balanceAfter ? formatMoney(t.balanceAfter, cur) : "—"} sub={t.status === "OPEN" ? "Trade still open" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          {t.screenshotPath && (
            <Card>
              <CardHeader>
                <CardTitle>Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <ScreenshotImage path={t.screenshotPath} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Journal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Before</p>
                  <EmotionChip emotion={t.emotionBefore} />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">After</p>
                  <EmotionChip emotion={t.emotionAfter} />
                </div>
              </div>
              <TextBlock title="Why I entered" text={t.setup} />
              <TextBlock title="Mistakes / lessons" text={t.mistakes} />
              <TextBlock title="Notes" text={t.notes} />
              {!t.setup && !t.mistakes && !t.notes && (
                <p className="text-sm text-muted-foreground">No written notes. Reviewing your trades is where the edge is. Add some via Edit.</p>
              )}
              {t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.tags.map((tag) => (
                    <Link key={tag} href={`/trades?tag=${encodeURIComponent(tag)}`}>
                      <Badge variant="secondary" className="hover:bg-accent">
                        #{tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="Entry">{formatNumber(t.entryPrice)}</Row>
              <Row label="Exit">{formatNumber(t.exitPrice)}</Row>
              <Row label={t.marketType === "FOREX" || t.marketType === "GOLD" ? "Lots" : "Quantity"}>{formatNumber(t.quantity)}</Row>
              {t.contractSize && Number(t.contractSize) !== DEFAULT_CONTRACT_SIZE[t.marketType] && (
                <Row label="Contract size">{formatNumber(t.contractSize)}</Row>
              )}
              <Row label="Leverage">{t.leverage ? `${Number(t.leverage)}×` : "—"}</Row>
              <Row label="Fees">{formatMoney(t.fees, cur)}</Row>
              <Row label="Stop loss">{formatNumber(t.stopLoss)}</Row>
              <Row label="Take profit">{formatNumber(t.takeProfit)}</Row>
              <Row label="Strategy">{t.strategy ?? "—"}</Row>
              <Row label="Timeframe">{t.timeframe ?? "—"}</Row>
              <Row label="Opened">{formatDate(t.openedAt, true)}</Row>
              <Row label="Closed">{t.closedAt ? formatDate(t.closedAt, true) : "—"}</Row>
              <Row label="Duration">{duration(t.openedAt, t.closedAt)}</Row>
            </dl>
            <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
              <Link href={`/trades?symbol=${encodeURIComponent(t.symbol)}`}>
                <Copy /> All {t.symbol} trades
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title={`Delete this ${t.symbol} trade?`}
        description="The account balance and equity curve will be recalculated without it. This can't be undone."
        confirmLabel="Delete trade"
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(t);
          setConfirmOpen(false);
          router.replace("/trades");
        }}
      />
    </>
  );
}
