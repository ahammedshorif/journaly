import { CheckCircle2, OctagonAlert, Target, TrendingDown } from "lucide-react";
import { fmtAmount } from "@/components/charts/chart-utils";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types/api";

const STATUS_TEXT: Record<Goal["progress"]["status"], string> = {
  on_track: "In progress",
  achieved: "Target reached",
  ok: "Within limit",
  warning: "Close to limit",
  breached: "Limit exceeded",
};

/** Progress bar for one goal. Status = icon + label + bar colour (never colour alone). */
export function GoalProgressBar({ goal, compact }: { goal: Goal; compact?: boolean }) {
  const isProfit = goal.type === "MONTHLY_PROFIT";
  const { progress } = goal;
  const pct = Math.min(100, progress.percent);
  // Profit target: always the profit hue. Loss limit: neutral → accent (warning) → loss hue (breached).
  const barColor = isProfit
    ? "bg-chart-profit"
    : progress.status === "breached"
      ? "bg-chart-loss"
      : progress.status === "warning"
        ? "bg-primary"
        : "bg-chart-neutral";
  const Icon = isProfit ? (progress.status === "achieved" ? CheckCircle2 : Target) : progress.status === "breached" ? OctagonAlert : TrendingDown;

  return (
    <div className="grid gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className={cn("size-4 shrink-0", progress.status === "breached" ? "text-loss" : progress.status === "achieved" ? "text-profit" : "text-muted-foreground")} />
            {isProfit ? "Monthly profit target" : "Max daily loss"}
          </p>
          {!compact && <p className="mt-0.5 text-xs text-muted-foreground">{goal.accountName ?? "All active accounts"}</p>}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{STATUS_TEXT[progress.status]}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={isProfit ? "Monthly profit target progress" : "Daily loss limit used"}
      >
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {isProfit ? (
          <>
            <span className="text-foreground">{fmtAmount(progress.current, goal.currency, { signed: true })}</span> of{" "}
            {fmtAmount(goal.amount, goal.currency)} this month · {progress.percent}%
          </>
        ) : (
          <>
            Today <span className="text-foreground">{fmtAmount(progress.current, goal.currency, { signed: true })}</span> · {progress.percent}% of{" "}
            {fmtAmount(goal.amount, goal.currency)} limit used · {fmtAmount(progress.remaining, goal.currency)} left
          </>
        )}
      </p>
    </div>
  );
}
