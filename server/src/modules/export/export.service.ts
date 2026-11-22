import type { Bucket, Metrics } from "../../domain/analytics";
import { isValidTimeZone } from "../../domain/time";
import { prisma } from "../../lib/prisma";
import { toCsv, type CsvCell } from "../../utils/csv";
import { createPdf, drawTable, pdfToBuffer, pnlColor, sectionTitle, type PdfColumn } from "../../utils/pdf";
import { analyticsService } from "../analytics/analytics.service";
import type { BreakdownQuery } from "../analytics/analytics.schema";
import { buildOrderBy, buildWhere, serializeTrade, tradeInclude } from "../trades/trades.service";
import type { ListTradesQuery } from "../trades/trades.schema";
import { MAX_EXPORT_TRADES } from "./export.schema";

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string | Buffer;
}

const stamp = () => new Date().toISOString().slice(0, 10);
const n2 = (v: string | null | undefined) => (v === null || v === undefined ? "" : Number(v).toFixed(2));
const num = (v: string | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)));

async function userTz(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone && isValidTimeZone(u.timezone) ? u.timezone : "UTC";
}

function fmtDate(d: Date | string | null, tz: string, withTime = true) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(new Date(d));
}

function rangeLabel(from: Date | undefined | null, to: Date | undefined | null, tz: string) {
  if (!from && !to) return "All time";
  return `${from ? fmtDate(from, tz, false) : "start"} – ${to ? fmtDate(to, tz, false) : "now"}`;
}

async function loadTrades(userId: string, q: Omit<ListTradesQuery, "page" | "pageSize">) {
  const query = { ...q, page: 1, pageSize: MAX_EXPORT_TRADES } as ListTradesQuery;
  const rows = await prisma.trade.findMany({
    where: buildWhere(userId, query),
    include: tradeInclude,
    orderBy: buildOrderBy(query),
    take: MAX_EXPORT_TRADES,
  });
  return rows.map(serializeTrade);
}

// ───────────────────────────── Trades ─────────────────────────────

export async function exportTradesCsv(userId: string, q: Omit<ListTradesQuery, "page" | "pageSize">): Promise<ExportFile> {
  const trades = await loadTrades(userId, q);
  const header = [
    "Opened (UTC)", "Closed (UTC)", "Account", "Currency", "Symbol", "Direction", "Market", "Status",
    "Entry", "Exit", "Quantity", "Contract size", "Leverage", "Fees", "Stop loss", "Take profit",
    "Risk type", "Risk value", "Risk amount", "Planned R:R", "Result", "Target hit", "SL hit",
    "Gross P&L", "Net P&L", "P&L manual", "Balance after", "Emotion before", "Emotion after",
    "Strategy", "Timeframe", "Why I entered", "Mistakes / lessons", "Notes", "Tags",
  ];
  const rows: CsvCell[][] = trades.map((t) => [
    t.openedAt, t.closedAt, t.account.name, t.account.currency, t.symbol, t.direction, t.marketType, t.status,
    num(t.entryPrice), num(t.exitPrice), num(t.quantity), num(t.contractSize), num(t.leverage), n2(t.fees),
    num(t.stopLoss), num(t.takeProfit), t.riskType, num(t.riskValue), n2(t.riskAmount), num(t.riskReward),
    t.result, t.targetHit, t.slHit, n2(t.grossPnl), n2(t.netPnl), t.pnlOverridden, n2(t.balanceAfter),
    t.emotionBefore, t.emotionAfter, t.strategy, t.timeframe, t.setup, t.mistakes, t.notes, t.tags.join("; "),
  ]);
  return { filename: `trades-${stamp()}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv([header, ...rows]) };
}

export async function exportTradesPdf(userId: string, q: Omit<ListTradesQuery, "page" | "pageSize">): Promise<ExportFile> {
  const [trades, tz] = await Promise.all([loadTrades(userId, q), userTz(userId)]);
  const closed = trades.filter((t) => t.netPnl !== null);
  const net = closed.reduce((s, t) => s + Number(t.netPnl), 0);
  const wins = closed.filter((t) => t.result === "PROFIT").length;
  const losses = closed.filter((t) => t.result === "LOSS").length;
  const currencies = [...new Set(trades.map((t) => t.account.currency))];
  const cur = currencies.length === 1 ? currencies[0] : "mixed";

  const doc = createPdf(
    "Trade log",
    `${trades.length} trades · ${rangeLabel(q.from, q.to, tz)} · net P&L ${net.toFixed(2)} ${cur} · win rate ${
      wins + losses ? ((wins / (wins + losses)) * 100).toFixed(1) + "%" : "-"
    } · generated ${fmtDate(new Date(), tz)} (${tz})`,
    true,
  );

  const columns: PdfColumn[] = [
    { header: "Opened", width: 11 },
    { header: "Account", width: 10 },
    { header: "Symbol", width: 9 },
    { header: "Side", width: 5 },
    { header: "Entry", width: 8, align: "right" },
    { header: "Exit", width: 8, align: "right" },
    { header: "Size", width: 7, align: "right" },
    { header: "Fees", width: 6, align: "right" },
    { header: "Net P&L", width: 9, align: "right", color: pnlColor },
    { header: "R:R", width: 5, align: "right" },
    { header: "Result", width: 7 },
    { header: "Emotion", width: 8 },
    { header: "Strategy", width: 10 },
  ];
  drawTable(
    doc,
    columns,
    trades.map((t) => [
      fmtDate(t.openedAt, tz),
      t.account.name,
      t.symbol,
      t.direction === "LONG" ? "Long" : "Short",
      num(t.entryPrice),
      num(t.exitPrice) || "-",
      num(t.quantity),
      n2(t.fees),
      t.netPnl ? n2(t.netPnl) : t.status === "OPEN" ? "open" : "-",
      t.riskReward ? `1:${Number(t.riskReward).toFixed(2)}` : "-",
      t.result ? t.result.charAt(0) + t.result.slice(1).toLowerCase() : t.status === "OPEN" ? "Open" : "-",
      t.emotionBefore ? t.emotionBefore.charAt(0) + t.emotionBefore.slice(1).toLowerCase() : "-",
      t.strategy ?? "-",
    ]),
  );

  return { filename: `trades-${stamp()}.pdf`, contentType: "application/pdf", body: await pdfToBuffer(doc) };
}

// ───────────────────────────── Analytics ─────────────────────────────

function metricRows(m: Metrics): [string, string][] {
  const v = (s: string | null, suffix = "") => (s === null ? "-" : `${s}${suffix}`);
  return [
    ["Net P&L", m.netPnl],
    ["ROI", v(m.roiPercent, "%")],
    ["Win rate", v(m.winRate, "%")],
    ["Total trades", String(m.totalTrades)],
    ["Wins / losses / breakeven", `${m.wins} / ${m.losses} / ${m.breakevens}`],
    ["Average win", v(m.avgWin)],
    ["Average loss", v(m.avgLoss)],
    ["Largest win", v(m.largestWin)],
    ["Largest loss", v(m.largestLoss)],
    ["Profit factor", v(m.profitFactor)],
    ["Expectancy (per trade)", v(m.expectancy)],
    ["Average planned R:R", m.avgRiskReward ? `1:${m.avgRiskReward}` : "-"],
    ["Average R multiple", v(m.avgRMultiple, "R")],
    ["Max drawdown", `${m.maxDrawdown}${m.maxDrawdownPercent ? ` (${m.maxDrawdownPercent}%)` : ""}`],
    ["Longest win streak", String(m.longestWinStreak)],
    ["Longest loss streak", String(m.longestLossStreak)],
    ["Gross profit", m.grossProfit],
    ["Gross loss", m.grossLoss],
    ["Total fees", m.totalFees],
  ];
}

const bucketHeader = ["Net P&L", "Trades", "Wins", "Losses", "Win rate %", "Avg P&L"];
const bucketCells = (b: Bucket): CsvCell[] => [b.netPnl, b.trades, b.wins, b.losses, b.winRate ?? "", b.avgPnl];

async function scopeLabel(userId: string, accountId?: string) {
  if (!accountId) return "All active accounts";
  const a = await prisma.journalAccount.findFirst({ where: { id: accountId, userId }, select: { name: true } });
  return a?.name ?? "Account";
}

export async function exportAnalyticsCsv(userId: string, q: BreakdownQuery): Promise<ExportFile> {
  const { report } = await analyticsService.buildReport(userId, q);
  const label = await scopeLabel(userId, q.accountId);
  const rows: CsvCell[][] = [
    ["Trading Journal analytics"],
    ["Scope", label],
    ["Range", rangeLabel(q.from, q.to, report.timezone)],
    ["Currency", report.currency ?? "mixed"],
    ["Timezone", report.timezone],
    [],
    ["Metric", "Value"],
    ...metricRows(report.metrics),
  ];
  const section = (title: string, keyHeader: string, buckets: Bucket[]) => {
    rows.push([], [title], [keyHeader, ...bucketHeader], ...buckets.map((b) => [b.label, ...bucketCells(b)]));
  };
  section(`P&L by ${q.period.replace("ly", "").replace("dai", "day")}`, "Period", report.periods);
  section("By pair", "Pair", report.byPair);
  section("By strategy", "Strategy", report.byStrategy);
  section("By day of week", "Day", report.byWeekday);
  section("By entry hour", "Hour", report.byHour);
  section("By direction", "Direction", report.byDirection);
  section("Emotion before entry", "Emotion", report.emotions.before);
  section("Emotion after exit", "Emotion", report.emotions.after);

  return { filename: `analytics-${stamp()}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(rows) };
}

export async function exportAnalyticsPdf(userId: string, q: BreakdownQuery): Promise<ExportFile> {
  const { report } = await analyticsService.buildReport(userId, q);
  const label = await scopeLabel(userId, q.accountId);
  const doc = createPdf(
    "Performance report",
    `${label} · ${rangeLabel(q.from, q.to, report.timezone)} · currency ${report.currency ?? "mixed"} · generated ${fmtDate(new Date(), report.timezone)} (${report.timezone})`,
  );

  sectionTitle(doc, "Key metrics");
  drawTable(
    doc,
    [
      { header: "Metric", width: 3 },
      { header: "Value", width: 2, align: "right" },
    ],
    metricRows(report.metrics),
  );

  const bucketTable = (title: string, keyHeader: string, buckets: Bucket[], limit = 40) => {
    if (!buckets.some((b) => b.trades > 0)) return;
    sectionTitle(doc, title);
    drawTable(
      doc,
      [
        { header: keyHeader, width: 3 },
        { header: "Net P&L", width: 2, align: "right", color: pnlColor },
        { header: "Trades", width: 1, align: "right" },
        { header: "Win rate", width: 1.4, align: "right" },
        { header: "Avg P&L", width: 2, align: "right", color: pnlColor },
      ],
      buckets
        .filter((b) => b.trades > 0)
        .slice(0, limit)
        .map((b) => [b.label, b.netPnl, String(b.trades), b.winRate ? `${b.winRate}%` : "-", b.avgPnl]),
    );
  };
  const emotionLabel = (bs: Bucket[]) => bs.map((b) => ({ ...b, label: b.label.charAt(0) + b.label.slice(1).toLowerCase() }));

  bucketTable("P&L by period", "Period", report.periods);
  bucketTable("Emotions before entry (costliest first)", "Emotion", emotionLabel(report.emotions.before));
  bucketTable("By pair", "Pair", report.byPair, 25);
  bucketTable("By strategy", "Strategy", report.byStrategy, 25);
  bucketTable("By day of week", "Day", report.byWeekday);
  bucketTable("By entry hour", "Hour", report.byHour);

  return { filename: `analytics-${stamp()}.pdf`, contentType: "application/pdf", body: await pdfToBuffer(doc) };
}

