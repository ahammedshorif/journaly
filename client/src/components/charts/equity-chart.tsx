"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "@/types/api";
import { TooltipBox } from "./chart-tooltip";
import { CHART, compactNumber, fmtAmount } from "./chart-utils";

interface Props {
  points: EquityPoint[];
  currency: string | null;
  /** "balance" = account equity incl. deposits; "pnl" = cumulative net P&L from the start of the range */
  metric?: "balance" | "pnl";
}

const shortDate = (t: number) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(t);
const longDate = (t: number) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(t);

/** Single series → no legend; the card title names it. Crosshair + tooltip on hover. */
export function EquityChart({ points, currency, metric = "balance" }: Props) {
  const gradientId = useId().replace(/:/g, "");
  const data = useMemo(
    () => points.map((p) => ({ t: new Date(p.time).getTime(), value: Number(metric === "balance" ? p.balance : p.cumulativePnl), p })),
    [points, metric],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.line} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART.line} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={shortDate}
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={compactNumber}
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
          domain={["auto", "auto"]}
        />
        {metric === "pnl" && <ReferenceLine y={0} stroke={CHART.axis} strokeDasharray="3 3" />}
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!active || !d) return null;
            return (
              <TooltipBox
                title={longDate(d.t)}
                rows={[
                  { label: "Balance", value: fmtAmount(d.p.balance, currency) },
                  { label: "Cumulative P&L", value: fmtAmount(d.p.cumulativePnl, currency, { signed: true }) },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART.line}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2, fill: CHART.line }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
