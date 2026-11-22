export type CsvCell = string | number | boolean | null | undefined | Date;

/**
 * RFC 4180 CSV with spreadsheet formula-injection protection: free-text cells that start with
 * = + - @ (or tab/CR) get a leading apostrophe so Excel/Sheets don't execute them.
 * Pass numbers as `number` (or numeric strings via `num()`) so negative values aren't escaped.
 */
const NUMERIC = /^-?\d+(\.\d+)?$/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  let s = value;
  if (!NUMERIC.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  // BOM so Excel opens UTF-8 (emoji, ৳, €) correctly
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
