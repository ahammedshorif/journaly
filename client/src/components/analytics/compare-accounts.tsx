"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { signedBarShape } from "@/components/charts/pnl-bar-chart";
import { TooltipBox } from "@/components/charts/chart-tooltip";
import { CHART, fmtAmount, signColor } from "@/components/charts/chart-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_LABEL } from "@/lib/constants";
import { formatPercent, pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountComparison } from "@/types/api";

/**
 * Accounts can have different currencies, so the chart compares ROI % (unit-free);
 * money columns in the table stay in each account's own currency.
 */
export function CompareAccounts({ data, loading }: { data?: AccountComparison[]; loading?: boolean }) {
  const rows = (data ?? []).filter((a) => a.metrics.totalTrades > 0 || !a.isArchived);
  const chartRows = rows.map((a) => ({ key: a.accountId, label: a.name, value: Number(a.metrics.roiPercent ?? 0), a }));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <ChartCard
        className="lg:col-span-2"
        title="ROI by account"
        description="Return on capital in the selected range"
        loading={loading}
        empty={!rows.length}
        emptyText="No accounts to compare."
        height={Math.max(200, rows.length * 44)}
        table={{
          columns: [{ label: "Account" }, { label: "ROI", align: "right" }],
          rows: rows.map((a) => [a.name, formatPercent(a.metrics.roiPercent, { signed: true })]),
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={120} tick={{ fill: "var(--foreground)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <ReferenceLine x={0} stroke={CHART.axis} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as (typeof chartRows)[number] | undefined;
                if (!active || !d) return null;
                return (
                  <TooltipBox
                    title={d.label}
                    rows={[
                      { label: "ROI", value: formatPercent(d.a.metrics.roiPercent, { signed: true }), color: signColor(d.value) },
                      { label: "Net P&L", value: fmtAmount(d.a.metrics.netPnl, d.a.currency, { signed: true }) },
                      { label: "Trades", value: String(d.a.metrics.totalTrades) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="value" maxBarSize={22} shape={signedBarShape(true)} isAnimationActive={false}>
              {chartRows.map((r) => (
                <Cell key={r.key} fill={signColor(r.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="min-w-0 lg:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Side by side</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                    <th className="px-3 py-2 text-right font-medium">Net P&amp;L</th>
                    <th className="px-3 py-2 text-right font-medium">Win rate</th>
                    <th className="px-3 py-2 text-right font-medium">PF</th>
                    <th className="px-3 py-2 text-right font-medium">Max DD</th>
                    <th className="px-3 py-2 text-right font-medium">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((a) => (
                    <tr key={a.accountId}>
                      <td className="px-3 py-2">
                        <Link href={`/accounts/${a.accountId}`} className="font-medium hover:underline">
                          {a.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {PLATFORM_LABEL[a.platform]} · {a.currency} {a.isArchived && <Badge variant="secondary">Archived</Badge>}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtAmount(a.currentBalance, a.currency)}</td>
                      <td className={cn("px-3 py-2 text-right font-medium tabular-nums", pnlClass(a.metrics.netPnl))}>
                        {fmtAmount(a.metrics.netPnl, a.currency, { signed: true })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.metrics.winRate ? `${a.metrics.winRate}%` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.metrics.profitFactor ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.metrics.maxDrawdownPercent ? `${a.metrics.maxDrawdownPercent}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.metrics.totalTrades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
