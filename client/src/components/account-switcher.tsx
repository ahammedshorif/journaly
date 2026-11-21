"use client";

import { Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounts";
import { cn } from "@/lib/utils";

const ALL = "__all__";

interface Props {
  value?: string;
  onChange: (accountId: string | undefined) => void;
  className?: string;
  /** Include archived accounts in the list (analytics) */
  includeArchived?: boolean;
}

export function AccountSwitcher({ value, onChange, className, includeArchived }: Props) {
  const { data: accounts = [] } = useAccounts(includeArchived ? "all" : "active");
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className={cn("w-full sm:w-56", className)} aria-label="Account">
        <Layers className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All accounts</SelectItem>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
            {a.isArchived ? " (archived)" : ""} · {a.currency}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
