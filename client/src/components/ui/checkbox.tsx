import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  label: React.ReactNode;
}

/** Native checkbox (accessible, form-friendly) styled with the accent colour. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ label, className, id, ...props }, ref) => (
  <label htmlFor={id} className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-sm", className)}>
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className="size-4 cursor-pointer rounded border-input accent-[var(--primary)] focus-visible:ring-2 focus-visible:ring-ring"
      {...props}
    />
    {label}
  </label>
));
Checkbox.displayName = "Checkbox";
