import { formatMoney } from "@/lib/format";

/** Money when the scope has one currency, plain signed number when currencies are mixed. */
export function fmtAmount(v: string | number | null | undefined, currency: string | null, opts?: { signed?: boolean }) {
  if (currency) return formatMoney(v, currency, opts);
  const n = Number(v ?? 0);
  const sign = opts?.signed && n > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/** Compact axis ticks: 1.2k, 3.4M */
export function compactNumber(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** SVG path for a bar with only its data end rounded (baseline end stays square). */
export function barPath(x: number, y: number, w: number, h: number, r: number, end: "top" | "bottom" | "left" | "right") {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const [tl, tr, br, bl] =
    end === "top" ? [rr, rr, 0, 0] : end === "bottom" ? [0, 0, rr, rr] : end === "right" ? [0, rr, rr, 0] : [rr, 0, 0, rr];
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    tr ? `Q${x + w},${y} ${x + w},${y + tr}` : "",
    `V${y + h - br}`,
    br ? `Q${x + w},${y + h} ${x + w - br},${y + h}` : "",
    `H${x + bl}`,
    bl ? `Q${x},${y + h} ${x},${y + h - bl}` : "",
    `V${y + tl}`,
    tl ? `Q${x},${y} ${x + tl},${y}` : "",
    "Z",
  ].join(" ");
}

export const CHART = {
  profit: "var(--chart-profit)",
  loss: "var(--chart-loss)",
  neutral: "var(--chart-neutral)",
  line: "var(--chart-line)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  surface: "var(--card)",
} as const;

export const signColor = (v: number) => (v > 0 ? CHART.profit : v < 0 ? CHART.loss : CHART.neutral);
