import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Trading Journal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log every trade, track every account, and learn from your emotions.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-xs">
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-loss-soft px-3 py-2 text-sm text-loss">
              Sign-in failed. Please try again.
            </p>
          )}
          <GoogleSignInButton next={safeNext} />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            We only use your Google name, email and avatar.
          </p>
        </div>
      </div>
    </div>
  );
}
