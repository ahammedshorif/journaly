"use client";

import { ErrorView } from "@/components/error-view";

/** Catches errors inside the app shell — sidebar and nav stay usable. */
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
