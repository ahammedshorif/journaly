/** Types mirroring the Express API responses. Money is always a decimal string. */

export type Platform = "BINANCE" | "BYBIT" | "FOREX" | "GOLD" | "OTHER";
export type TransactionType = "DEPOSIT" | "WITHDRAWAL";
export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  currency: string;
  timezone: string;
  theme: ThemePreference;
  createdAt: string;
}

export interface AccountStats {
  currentBalance: string;
  netDeposits: string;
  investedCapital: string;
  totalPnl: string;
  roiPercent: string | null;
  winRate: string | null;
  closedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
}

export interface JournalAccount {
  id: string;
  name: string;
  platform: Platform;
  initialBalance: string;
  currency: string;
  notes: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: AccountStats;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: string;
  note: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type Direction = "LONG" | "SHORT";
export type MarketType = "SPOT" | "FUTURES" | "FOREX" | "GOLD" | "OTHER";
export type TradeStatus = "OPEN" | "CLOSED";
export type TradeResult = "PROFIT" | "LOSS" | "BREAKEVEN";
export type RiskType = "AMOUNT" | "PERCENT";
export type Emotion =
  | "CONFIDENT"
  | "CALM"
  | "NEUTRAL"
  | "EXCITED"
  | "FEAR"
  | "GREED"
  | "FOMO"
  | "REVENGE"
  | "ANXIOUS"
  | "BORED"
  | "FRUSTRATED"
  | "IMPATIENT";

export interface Trade {
  id: string;
  accountId: string;
  account: { id: string; name: string; currency: string };
  symbol: string;
  direction: Direction;
  marketType: MarketType;
  status: TradeStatus;
  entryPrice: string;
  exitPrice: string | null;
  quantity: string;
  contractSize: string | null;
  leverage: string | null;
  fees: string;
  stopLoss: string | null;
  takeProfit: string | null;
  riskType: RiskType | null;
  riskValue: string | null;
  riskAmount: string | null;
  riskReward: string | null;
  result: TradeResult | null;
  resultOverridden: boolean;
  targetHit: boolean;
  slHit: boolean;
  grossPnl: string | null;
  netPnl: string | null;
  pnlOverridden: boolean;
  balanceAfter: string | null;
  emotionBefore: Emotion | null;
  emotionAfter: Emotion | null;
  setup: string | null;
  strategy: string | null;
  timeframe: string | null;
  mistakes: string | null;
  notes: string | null;
  tags: string[];
  screenshotPath: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeListSummary {
  netPnl: string;
  closedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: string | null;
}

export interface TradeList extends Paginated<Trade> {
  summary: TradeListSummary;
}

export interface TradeMeta {
  symbols: string[];
  strategies: string[];
  tags: string[];
}

// ───────── Analytics ─────────

export type Period = "daily" | "weekly" | "monthly" | "yearly";

export interface DashboardSummary {
  currency: string | null;
  mixedCurrencies: boolean;
  timezone: string;
  accounts: number;
  totalBalance: string | null;
  totalPnl: string | null;
  balances: { currency: string; balance: string; totalPnl: string; accounts: number }[];
  pnl: { today: string; week: string; month: string };
  winRate: string | null;
  wins: number;
  losses: number;
  closedTrades: number;
  openTrades: number;
}

export interface EquityPoint {
  time: string;
  balance: string;
  cumulativePnl: string;
  tradeId: string | null;
}

export interface EquityCurve {
  currency: string | null;
  mixedCurrencies: boolean;
  points: EquityPoint[];
}

export interface Metrics {
  netPnl: string;
  grossProfit: string;
  grossLoss: string;
  totalFees: string;
  roiPercent: string | null;
  winRate: string | null;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  avgWin: string | null;
  avgLoss: string | null;
  largestWin: string | null;
  largestLoss: string | null;
  profitFactor: string | null;
  expectancy: string | null;
  avgRiskReward: string | null;
  avgRMultiple: string | null;
  maxDrawdown: string;
  maxDrawdownPercent: string | null;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface Bucket {
  key: string;
  label: string;
  netPnl: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: string | null;
  avgPnl: string;
}

export interface AnalyticsReport {
  currency: string | null;
  mixedCurrencies: boolean;
  timezone: string;
  period: Period;
  range: { from: string | null; to: string | null };
  startBalance: string;
  metrics: Metrics;
  periods: Bucket[];
  byPair: Bucket[];
  byStrategy: Bucket[];
  byWeekday: Bucket[];
  byHour: Bucket[];
  byDirection: Bucket[];
  emotions: { before: Bucket[]; after: Bucket[] };
  calendar: { date: string; netPnl: string; trades: number }[];
  equityCurve: EquityPoint[];
}

export interface AccountComparison {
  accountId: string;
  name: string;
  platform: Platform;
  currency: string;
  isArchived: boolean;
  currentBalance: string;
  metrics: Metrics;
}

// ───────── Goals ─────────

export type GoalType = "MONTHLY_PROFIT" | "MAX_DAILY_LOSS";
export type GoalStatus = "on_track" | "achieved" | "ok" | "warning" | "breached";

export interface Goal {
  id: string;
  type: GoalType;
  amount: string;
  accountId: string | null;
  accountName: string | null;
  currency: string | null;
  mixedCurrencies: boolean;
  isActive: boolean;
  createdAt: string;
  progress: { current: string; percent: number; status: GoalStatus; remaining: string };
}

export interface RiskWarning {
  level: "warning" | "danger";
  code: string;
  message: string;
  accountId: string | null;
}

export interface GoalsResponse {
  goals: Goal[];
  warnings: RiskWarning[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}
