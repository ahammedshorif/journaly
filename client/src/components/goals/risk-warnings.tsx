"use client";

import { AlertTriangle, OctagonAlert } from "lucide-react";
import { useGoals } from "@/hooks/use-goals";
import { cn } from "@/lib/utils";

/** Live risk warnings (daily loss limit, loss streak). Icon + text, never colour alone. */
export function RiskWarnings({ className }: { className?: string }) {
  const { data } = useGoals();
  if (!data?.warnings.length) return null;

  return (
    <div className={cn("grid gap-2", className)} role="alert">
      {data.warnings.map((w, i) => {
        const danger = w.level === "danger";
        const Icon = danger ? OctagonAlert : AlertTriangle;
        return (
          <div
            key={`${w.code}-${i}`}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
              danger ? "border-loss/40 bg-loss-soft text-loss" : "border-primary/30 bg-primary/10 text-foreground",
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", !danger && "text-primary")} />
            <p>
              <strong className="font-semibold">{danger ? "Risk limit hit: " : "Heads up: "}</strong>
              {w.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}
