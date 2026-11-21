"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bucket } from "@/types/api";
import { TooltipBox } from "./chart-tooltip";
import { barPath, CHART, compactNumber, fmtAmount, signColor } from "./chart-utils";

interface Props {
  data: Bucket[];
  currency: string | null;
  /** "vertical" = categories on X (time, weekday, hour); "horizontal" = categories on Y (pairs, strategies) */
  layout?: "vertical" | "horizontal";
  labelWidth?: number;
}

type ShapeProps = { x?: number; y?: number; width?: number; height?: number; payload?: { value: number } };

/** Bar shape coloured by sign, rounded only at the data end, anchored to the zero line. */
export function signedBarShape(horizontal: boolean) {
  return function SignedBar(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props as ShapeProps;
    const v = payload?.value ?? 0;
    if (!v) return <g />;
    // Recharts may hand us negative sizes for negative values — normalise first.
    const nx = width < 0 ? x + width : x;
    const ny = height < 0 ? y + height : y;
    const end = horizontal ? (v > 0 ? "right" : "left") : v > 0 ? "top" : "bottom";
    return <path d={barPath(nx, ny, Math.abs(width), Math.abs(height), 4, end)} fill={signColor(v)} />;
  };
}

/**
 * Polarity-coloured P&L bars: profit / loss hues, rounded only at the data end, anchored to zero.
 * Sign is also encoded by position (above/below or left/right of the zero line), so colour is never the only cue.
 */
export function PnlBarChart({ data, currency, layout = "vertical", labelWidth = 84 }: Props) {
  const rows = data.map((b) => ({ ...b, value: Number(b.netPnl) }));
  const horizontal = layout === "horizontal";

  const shape = signedBarShape(horizontal);

  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
      content={({ active, payload }) => {
        const d = payload?.[0]?.payload as (typeof rows)[number] | undefined;
        if (!active || !d) return null;
        return (
          <TooltipBox
            title={d.label}
            rows={[
              { label: "Net P&L", value: fmtAmount(d.netPnl, currency, { signed: true }), color: signColor(d.value) },
              { label: "Trades", value: String(d.trades) },
              { label: "Win rate", value: d.winRate ? `${d.winRate}%` : "—" },
              { label: "Avg / trade", value: fmtAmount(d.avgPnl, currency, { signed: true }) },
            ]}
          />
        );
      }}
    />
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      {horizontal ? (
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={4}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={compactNumber} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <ReferenceLine x={0} stroke={CHART.axis} />
          {tooltip}
          <Bar dataKey="value" shape={shape} maxBarSize={22} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.key} fill={signColor(r.value)} />
            ))}
          </Bar>
        </BarChart>
      ) : (
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis tickFormatter={compactNumber} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          <ReferenceLine y={0} stroke={CHART.axis} />
          {tooltip}
          <Bar dataKey="value" shape={shape} maxBarSize={36} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.key} fill={signColor(r.value)} />
            ))}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
