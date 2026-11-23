"use client";

import { useEffect, useState } from "react";
import { reloadOnce } from "@/lib/errors";
import "./globals.css";

/**
 * Last-resort boundary (errors in the root layout itself). Replaces Next.js's built-in
 * "This page couldn't load" screen: reloads once automatically, then shows the error.
 * Must render its own <html> and <body>.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(true);

  useEffect(() => {
    console.error("[TradingJournal] fatal error:", error);
    if (!reloadOnce(error)) setReloading(false);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        {reloading ? (
          <p className="text-sm text-muted-foreground">Refreshing…</p>
        ) : (
          <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs whitespace-pre-wrap break-words">
              {error.message || "Unknown error"}
              {error.digest ? `\n\nRef: ${error.digest}` : ""}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Reload page
            </button>
          </div>
        )}
      </body>
    </html>
  );
}
