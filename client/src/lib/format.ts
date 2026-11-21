/** Display helpers. The API returns money as decimal strings; we only convert to number for display. */

const ISO_FIAT = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "BDT", "INR", "SGD", "AED"]);

export function formatMoney(value: string | number | null | undefined, currency = "USD", opts?: { signed?: boolean }) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const sign = opts?.signed && safe > 0 ? "+" : "";

  if (ISO_FIAT.has(currency)) {
    return (
      sign +
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safe)
    );
  }
  // Crypto / non-ISO units (USDT, USDC, BTC…) — Intl would throw
  return `${sign}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)} ${currency}`;
}

export function formatPercent(value: string | number | null | undefined, opts?: { signed?: boolean }) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = opts?.signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatDate(value: string | Date, withTime = false) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(d);
}

/** -1 | 0 | 1 for colouring P&L */
export function pnlSign(value: string | number | null | undefined): -1 | 0 | 1 {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n > 0 ? 1 : -1;
}

export function pnlClass(value: string | number | null | undefined) {
  const s = pnlSign(value);
  return s > 0 ? "text-profit" : s < 0 ? "text-loss" : "text-muted-foreground";
}
