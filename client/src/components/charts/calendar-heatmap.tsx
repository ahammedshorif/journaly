"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtAmount } from "./chart-utils";

interface Props {
  days: { date: string; netPnl: string; trades: number }[];
  /** YYYY-MM-DD bounds (in the user's timezone, as produced by the API) */
  from: string;
  to: string;
  currency: string | null;
}

const DOW = ["Mon", "", "Wed", "", "Fri", "", ""];
const STEPS = [25, 45, 70, 100]; // % of the hue mixed into the empty-cell colour

/** Calendar arithmetic on plain dates (UTC) so the browser's timezone never shifts a day. */
const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};
const key = (d: Date) => d.toISOString().slice(0, 10);

function cellColor(v: number, maxAbs: number) {
  if (v === 0) return "var(--chart-neutral)";
  const ratio = Math.abs(v) / (maxAbs || 1);
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(ratio * STEPS.length))]!;
  const hue = v > 0 ? "var(--chart-profit)" : "var(--chart-loss)";
  return `color-mix(in oklab, ${hue} ${step}%, var(--heat-empty))`;
}

/**
 * Diverging heatmap of daily P&L: loss hue ← neutral → profit hue, intensity by size.
 * Hover/focus a day for exact numbers; days without trades stay the empty colour.
 */
export function CalendarHeatmap({ days, from, to, currency }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const maxAbs = useMemo(() => Math.max(0, ...days.map((d) => Math.abs(Number(d.netPnl)))), [days]);

  const weeks = useMemo(() => {
    const start = parse(from);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); // back to Monday
    const end = parse(to);
    const cols: { date: string; inRange: boolean }[][] = [];
    for (let d = new Date(start); d <= end || cols.at(-1)?.length !== 7; d.setUTCDate(d.getUTCDate() + 1)) {
      if (!cols.length || cols.at(-1)!.length === 7) cols.push([]);
      const k = key(d);
      cols.at(-1)!.push({ date: k, inRange: k >= from && k <= to });
      if (cols.length > 60) break; // safety
    }
    return cols;
  }, [from, to]);

  // One label per month, skipped when it would collide with the previous one (needs ~3 columns).
  const monthLabels: string[] = [];
  let lastLabelAt = -10;
  weeks.forEach((w, i) => {
    const first = w.find((d) => d.inRange)?.date ?? w[0]!.date;
    const prev = i > 0 ? (weeks[i - 1]!.find((d) => d.inRange)?.date ?? weeks[i - 1]![0]!.date) : null;
    const isNewMonth = !prev || first.slice(5, 7) !== prev.slice(5, 7);
    if (isNewMonth && i - lastLabelAt >= 3) {
      monthLabels.push(new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(parse(first)));
      lastLabelAt = i;
    } else monthLabels.push("");
  });

  const hovered = hover ? byDate.get(hover) : undefined;
  const hoverLabel = hover
    ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parse(hover))
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1">
          <div className="mr-1 grid grid-rows-[16px_repeat(7,14px)] gap-[3px] text-[10px] text-muted-foreground">
            <span />
            {DOW.map((d, i) => (
              <span key={i} className="leading-[14px]">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((w, i) => (
            <div key={w[0]!.date} className="grid grid-rows-[16px_repeat(7,14px)] gap-[3px]">
              <span className="whitespace-nowrap text-[10px] leading-4 text-muted-foreground">{monthLabels[i]}</span>
              {w.map(({ date, inRange }) => {
                const d = byDate.get(date);
                const v = d ? Number(d.netPnl) : null;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!inRange}
                    onMouseEnter={() => setHover(date)}
                    onFocus={() => setHover(date)}
                    onMouseLeave={() => setHover(null)}
                    aria-label={`${date}: ${d ? `${fmtAmount(d.netPnl, currency, { signed: true })}, ${d.trades} trades` : "no trades"}`}
                    className={cn(
                      "size-[14px] rounded-[3px] outline-none ring-offset-1 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring",
                      !inRange && "invisible",
                      hover === date && "ring-2 ring-foreground/40",
                    )}
                    style={{ background: v === null ? "var(--heat-empty)" : cellColor(v, maxAbs) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
        <span className="min-h-4 tabular-nums" aria-live="polite">
          {hoverLabel ? (
            <>
              <span className="text-foreground">{hoverLabel}</span>
              {" · "}
              {hovered ? `${fmtAmount(hovered.netPnl, currency, { signed: true })} · ${hovered.trades} trade${hovered.trades === 1 ? "" : "s"}` : "no trades"}
            </>
          ) : (
            "Hover a day for details"
          )}
        </span>
        <span className="flex items-center gap-1">
          Loss
          {[...STEPS].reverse().map((s) => (
            <span key={`l${s}`} className="size-3 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--chart-loss) ${s}%, var(--heat-empty))` }} />
          ))}
          <span className="size-3 rounded-[3px]" style={{ background: "var(--heat-empty)" }} />
          {STEPS.map((s) => (
            <span key={`p${s}`} className="size-3 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--chart-profit) ${s}%, var(--heat-empty))` }} />
          ))}
          Profit
        </span>
      </div>
    </div>
  );
}
