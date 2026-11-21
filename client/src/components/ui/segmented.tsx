"use client";

import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional colour when active */
  tone?: "default" | "profit" | "loss";
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  className?: string;
  size?: "sm" | "default";
}

/** Radio-group style toggle (Long/Short, Open/Closed, result…). */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel, className, size = "default" }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex w-full rounded-lg bg-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 cursor-pointer rounded-md px-3 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "py-1 text-xs" : "py-1.5 text-sm",
              active
                ? cn(
                    "bg-card shadow-sm",
                    o.tone === "profit" && "text-profit",
                    o.tone === "loss" && "text-loss",
                  )
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
