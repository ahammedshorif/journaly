"use client";

import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { lastAutoReloadError, reloadOnce } from "@/lib/errors";

interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared body for error.tsx boundaries.
 * 1st failure → reload automatically (what clicking "Reload" did by hand).
 * Fails again right after → show the real error with Try again / Reload / Dashboard.
 */
export function ErrorView({ error }: ErrorViewProps) {
  const [reloading, setReloading] = useState(true);

  useEffect(() => {
    console.error("[TradingJournal] page error:", error);
    const previous = lastAutoReloadError();
    if (previous) console.error("[TradingJournal] error before the last auto-reload:", previous);
    if (!reloadOnce(error)) setReloading(false);
  }, [error]);

  if (reloading) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Refreshing…
      </div>
    );
  }

  return (
    <div className="flex min-h-[50dvh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-xs">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-loss-soft text-loss">
          <AlertTriangle className="size-6" />
        </div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your data is safe. Reload the page, or go back to the dashboard.</p>
        <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs whitespace-pre-wrap break-words">
          {error.message || "Unknown error"}
          {error.digest ? `\n\nRef: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCw /> Reload page
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
