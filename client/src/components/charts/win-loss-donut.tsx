"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { TooltipBox } from "./chart-tooltip";
import { CHART } from "./chart-utils";

interface Props {
  wins: number;
  losses: number;
  breakevens: number;
  winRate: string | null;
}

/** Donut with a 2px surface gap between slices, win rate in the centre, and a direct-labelled legend. */
export function WinLossDonut({ wins, losses, breakevens, winRate }: Props) {
  const total = wins + losses + breakevens;
  const data = [
    { name: "Wins", value: wins, color: CHART.profit },
    { name: "Losses", value: losses, color: CHART.loss },
    { name: "Breakeven", value: breakevens, color: CHART.neutral },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex h-full items-center gap-6">
      <div className="relative h-full min-h-40 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              stroke={CHART.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !d) return null;
                return (
                  <TooltipBox
                    title={d.name}
                    rows={[
                      { label: "Trades", value: String(d.value), color: d.color },
                      { label: "Share", value: `${((d.value / total) * 100).toFixed(1)}%` },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{winRate ? `${Number(winRate).toFixed(1)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">win rate</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-2 text-sm">
        {[
          { name: "Wins", value: wins, color: CHART.profit },
          { name: "Losses", value: losses, color: CHART.loss },
          { name: "Breakeven", value: breakevens, color: CHART.neutral },
        ].map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: d.color }} aria-hidden />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
