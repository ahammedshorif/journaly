import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2 font-serif text-lg font-semibold", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        {/* <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg> */}

      <svg
  viewBox="0 0 24 24"
  className="size-6"
  fill="none"
  stroke="currentColor"
  strokeWidth={2}
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-hidden
>
  {/* Journal-inspired J */}
  <path d="M12 3v13a5 5 0 0 1-5 5H5" />

  {/* Rising trading chart */}
  <path d="m5 14 5-5 4 3 6-7" />

  {/* Growth arrow */}
  <path d="M14 5h6v6" />
</svg>
      </span>
      <span>Journal<span className="text-primary">y</span></span>
    </Link>
  );
}
