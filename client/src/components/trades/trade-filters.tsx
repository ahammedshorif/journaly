"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTradeMeta, type TradeFilters as Filters } from "@/hooks/use-trades";
import { EMOTIONS, MARKET_TYPES, RESULT_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ALL = "__all__";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  activeCount: number;
  hideAccount?: boolean;
}

const SORTS = [
  { value: "openedAt:desc", label: "Newest first" },
  { value: "openedAt:asc", label: "Oldest first" },
  { value: "netPnl:desc", label: "Biggest win" },
  { value: "netPnl:asc", label: "Biggest loss" },
  { value: "closedAt:desc", label: "Recently closed" },
  { value: "symbol:asc", label: "Symbol A–Z" },
] as const;

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const id = `f-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Date input value (YYYY-MM-DD) ↔ ISO start/end of the local day */
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);
const isoToDay = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function TradeFilters({ filters, onChange, onReset, activeCount, hideAccount }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(filters.q ?? "");
  const debounced = useDebouncedValue(search);
  const { data: accounts = [] } = useAccounts("all");
  const { data: meta } = useTradeMeta();

  useEffect(() => {
    if ((filters.q ?? "") !== debounced) onChange({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep the box in sync when filters are reset externally
  useEffect(() => {
    if (!filters.q) setSearch("");
  }, [filters.q]);

  const sortValue = `${filters.sortBy ?? "openedAt"}:${filters.sortDir ?? "desc"}`;

  return (
    <div className="mb-4 grid gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol, setup, notes, mistakes…"
            className="pl-9"
            aria-label="Search trades"
          />
        </div>
        <Select
          value={sortValue}
          onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [Filters["sortBy"], Filters["sortDir"]];
            onChange({ sortBy, sortDir });
          }}
        >
          <SelectTrigger className="hidden w-44 sm:flex" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{activeCount}</span>
          )}
        </Button>
      </div>

      <div className={cn("grid-cols-2 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4", open ? "grid" : "hidden")}>
        <div className="col-span-2 grid gap-1.5 sm:hidden">
          <Label className="text-xs text-muted-foreground">Sort</Label>
          <Select
            value={sortValue}
            onValueChange={(v) => {
              const [sortBy, sortDir] = v.split(":") as [Filters["sortBy"], Filters["sortDir"]];
              onChange({ sortBy, sortDir });
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hideAccount && (
          <FilterSelect
            label="Account"
            allLabel="All accounts"
            value={filters.accountId}
            onChange={(accountId) => onChange({ accountId })}
            options={accounts.map((a) => ({ value: a.id, label: a.isArchived ? `${a.name} (archived)` : a.name }))}
          />
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="f-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input id="f-from" type="date" className="h-9" value={isoToDay(filters.from)} onChange={(e) => onChange({ from: dayStart(e.target.value) })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input id="f-to" type="date" className="h-9" value={isoToDay(filters.to)} onChange={(e) => onChange({ to: dayEnd(e.target.value) })} />
        </div>
        <FilterSelect
          label="Pair"
          value={filters.symbol}
          onChange={(symbol) => onChange({ symbol })}
          options={(meta?.symbols ?? []).map((s) => ({ value: s, label: s }))}
        />
        <FilterSelect
          label="Result"
          value={filters.result}
          onChange={(result) => onChange({ result: result as Filters["result"] })}
          options={Object.entries(RESULT_META).map(([value, m]) => ({ value, label: `${m.emoji} ${m.label}` }))}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(status) => onChange({ status: status as Filters["status"] })}
          options={[
            { value: "OPEN", label: "Open" },
            { value: "CLOSED", label: "Closed" },
          ]}
        />
        <FilterSelect
          label="Direction"
          value={filters.direction}
          onChange={(direction) => onChange({ direction: direction as Filters["direction"] })}
          options={[
            { value: "LONG", label: "Long" },
            { value: "SHORT", label: "Short" },
          ]}
        />
        <FilterSelect
          label="Market"
          value={filters.marketType}
          onChange={(marketType) => onChange({ marketType: marketType as Filters["marketType"] })}
          options={MARKET_TYPES}
        />
        <FilterSelect
          label="Emotion (before or after)"
          value={filters.emotion}
          onChange={(emotion) => onChange({ emotion: emotion as Filters["emotion"] })}
          options={EMOTIONS.map((e) => ({ value: e.value, label: `${e.emoji} ${e.label}` }))}
        />
        <FilterSelect
          label="Strategy"
          value={filters.strategy}
          onChange={(strategy) => onChange({ strategy })}
          options={(meta?.strategies ?? []).map((s) => ({ value: s, label: s }))}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          onChange={(tag) => onChange({ tag })}
          options={(meta?.tags ?? []).map((t) => ({ value: t, label: t }))}
        />
        <div className="col-span-full flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={activeCount === 0}>
            <X /> Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}
