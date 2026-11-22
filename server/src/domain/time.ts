/**
 * Timezone helpers built on Intl (no extra deps). All bucketing (day/week/month/hour)
 * happens in the user's timezone so "today" means *their* today.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LABELS = WEEKDAYS;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
}

export function isValidTimeZone(tz: string) {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.indexOf(get("weekday") as (typeof WEEKDAYS)[number]),
  };
}

/** Offset of `timeZone` from UTC at `date`, in ms (e.g. Asia/Dhaka = +6h). */
function offsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of a wall-clock time in `timeZone` (DST-safe). */
export function zonedTimeToUtc(year: number, month: number, day: number, timeZone: string, hour = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  let ts = guess - offsetMs(new Date(guess), timeZone);
  const corrected = guess - offsetMs(new Date(ts), timeZone); // second pass across DST edges
  if (corrected !== ts) ts = corrected;
  return new Date(ts);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar date arithmetic on plain Y-M-D (no timezone involved). */
function addDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function dayKey(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Monday of the local week, as YYYY-MM-DD */
export function weekKey(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const mon = addDays(p.year, p.month, p.day, -p.weekday);
  return `${mon.year}-${pad(mon.month)}-${pad(mon.day)}`;
}

export function monthKey(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}`;
}

export function yearKey(date: Date, tz: string) {
  return String(zonedParts(date, tz).year);
}

export type Period = "daily" | "weekly" | "monthly" | "yearly";

export function periodKey(date: Date, tz: string, period: Period) {
  switch (period) {
    case "daily":
      return dayKey(date, tz);
    case "weekly":
      return weekKey(date, tz);
    case "monthly":
      return monthKey(date, tz);
    case "yearly":
      return yearKey(date, tz);
  }
}

export function startOfDay(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.year, p.month, p.day, tz);
}

export function startOfWeek(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const mon = addDays(p.year, p.month, p.day, -p.weekday);
  return zonedTimeToUtc(mon.year, mon.month, mon.day, tz);
}

export function startOfMonth(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.year, p.month, 1, tz);
}

/** All day keys between two instants (inclusive), in the user's timezone — for the calendar heatmap. */
export function dayKeysBetween(from: Date, to: Date, tz: string, max = 400): string[] {
  const a = zonedParts(from, tz);
  const b = zonedParts(to, tz);
  const end = `${b.year}-${pad(b.month)}-${pad(b.day)}`;
  const out: string[] = [];
  let cur = { year: a.year, month: a.month, day: a.day };
  for (let i = 0; i < max; i++) {
    const key = `${cur.year}-${pad(cur.month)}-${pad(cur.day)}`;
    out.push(key);
    if (key >= end) break;
    cur = addDays(cur.year, cur.month, cur.day, 1);
  }
  return out;
}
