"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagsInput } from "@/components/ui/tags-input";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreateTrade, useTradeMeta, useUpdateTrade } from "@/hooks/use-trades";
import { DEFAULT_CONTRACT_SIZE, MARKET_TYPES, PLATFORM_DEFAULT_MARKET, RESULT_META, TIMEFRAMES } from "@/lib/constants";
import { formatMoney, pnlClass } from "@/lib/format";
import { removeScreenshot } from "@/lib/screenshots";
import { formatRR, previewTrade } from "@/lib/trade-calc";
import { cn } from "@/lib/utils";
import {
  emptyTradeForm,
  formToPayload,
  tradeFormSchema,
  tradeToForm,
  type TradeFormValues,
} from "@/lib/validations/trade";
import type { JournalAccount, Trade } from "@/types/api";
import { EmotionSelect } from "./emotion-select";
import { ScreenshotUpload } from "./screenshot";

interface TradeFormProps {
  trade?: Trade;
  defaultAccountId?: string;
}

const err = (e: FieldErrors<TradeFormValues>, k: keyof TradeFormValues) => e[k]?.message as string | undefined;

export function TradeForm({ trade, defaultAccountId }: TradeFormProps) {
  const router = useRouter();
  const isEdit = Boolean(trade);
  const { data: accounts = [] } = useAccounts("active");
  const { data: meta } = useTradeMeta();
  const create = useCreateTrade();
  const update = useUpdateTrade(trade?.id ?? "");
  const saving = create.isPending || update.isPending;

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: trade ? tradeToForm(trade) : emptyTradeForm(defaultAccountId),
    mode: "onTouched",
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = form;

  const v = useWatch({ control }) as TradeFormValues;
  const closed = v.status === "CLOSED";

  const account: JournalAccount | undefined = accounts.find((a) => a.id === v.accountId);
  const currency = account?.currency ?? trade?.account.currency ?? "USD";
  const balance = account ? Number(account.stats.currentBalance) : undefined;

  // Default the account (first active) and market type (from platform) for new trades.
  useEffect(() => {
    if (isEdit || v.accountId || !accounts.length) return;
    setValue("accountId", accounts[0]!.id);
  }, [isEdit, v.accountId, accounts, setValue]);

  useEffect(() => {
    if (isEdit) return;
    const acc = accounts.find((a) => a.id === v.accountId);
    if (acc && !getFieldState("marketType").isDirty) setValue("marketType", PLATFORM_DEFAULT_MARKET[acc.platform]);
  }, [isEdit, v.accountId, accounts, getFieldState, setValue]);

  const preview = useMemo(() => previewTrade({ ...v, balance }), [v, balance]);
  const shownNet = v.overridePnl ? (v.manualNetPnl && Number.isFinite(Number(v.manualNetPnl)) ? Number(v.manualNetPnl) : null) : preview.netPnl;
  const autoResult = shownNet === null ? null : shownNet > 0 ? "PROFIT" : shownNet < 0 ? "LOSS" : "BREAKEVEN";
  const isLots = v.marketType === "FOREX" || v.marketType === "GOLD";

  // ── Screenshot bookkeeping: delete files only after a successful save; clean up unsaved uploads.
  const originalShot = useRef(trade?.screenshotPath ?? null);
  const uploaded = useRef(new Set<string>());
  const saved = useRef(false);
  useEffect(() => {
    if (v.screenshotPath && v.screenshotPath !== originalShot.current) uploaded.current.add(v.screenshotPath);
  }, [v.screenshotPath]);
  useEffect(
    () => () => {
      if (!saved.current) uploaded.current.forEach((p) => void removeScreenshot(p));
    },
    [],
  );

  const onSubmit = handleSubmit(async (values) => {
    const payload = formToPayload(values);
    try {
      const result = isEdit
        ? await update.mutateAsync(payload)
        : await create.mutateAsync({ ...payload, accountId: values.accountId });
      saved.current = true;
      const keep = values.screenshotPath;
      [originalShot.current, ...uploaded.current].forEach((p) => p && p !== keep && void removeScreenshot(p));
      router.push(`/trades/${result.id}`);
    } catch {
      // toast shown globally
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 pb-24 lg:grid-cols-3">
      <div className="grid gap-5 lg:col-span-2">
        {/* ── Basics ── */}
        <Card>
          <CardHeader>
            <CardTitle>Trade</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Account" htmlFor="accountId" error={err(errors, "accountId")}>
              {isEdit ? (
                <Input id="accountId" value={trade!.account.name} disabled />
              ) : (
                <Controller
                  control={control}
                  name="accountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="accountId" aria-invalid={!!errors.accountId}>
                        <SelectValue placeholder={accounts.length ? "Select account" : "Create an account first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} · {a.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>

            <FormField label="Pair / symbol" htmlFor="symbol" error={err(errors, "symbol")}>
              <Input
                id="symbol"
                list="symbol-list"
                placeholder="BTCUSDT, EURUSD, XAUUSD…"
                autoCapitalize="characters"
                className="uppercase"
                aria-invalid={!!errors.symbol}
                {...register("symbol")}
              />
              <datalist id="symbol-list">{meta?.symbols.map((s) => <option key={s} value={s} />)}</datalist>
            </FormField>

            <FormField label="Direction" htmlFor="direction">
              <Controller
                control={control}
                name="direction"
                render={({ field }) => (
                  <Segmented
                    ariaLabel="Direction"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "LONG", label: "▲ Long", tone: "profit" },
                      { value: "SHORT", label: "▼ Short", tone: "loss" },
                    ]}
                  />
                )}
              />
            </FormField>

            <FormField label="Market type" htmlFor="marketType">
              <Controller
                control={control}
                name="marketType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="marketType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKET_TYPES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Status" htmlFor="status" className="sm:col-span-2">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Segmented
                    ariaLabel="Status"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "CLOSED", label: "Closed" },
                      { value: "OPEN", label: "Open (still running)" },
                    ]}
                  />
                )}
              />
            </FormField>

            <FormField label="Opened" htmlFor="openedAt" error={err(errors, "openedAt")}>
              <Input id="openedAt" type="datetime-local" aria-invalid={!!errors.openedAt} {...register("openedAt")} />
            </FormField>
            {closed && (
              <FormField label="Closed" htmlFor="closedAt" error={err(errors, "closedAt")}>
                <Input id="closedAt" type="datetime-local" aria-invalid={!!errors.closedAt} {...register("closedAt")} />
              </FormField>
            )}
          </CardContent>
        </Card>

        {/* ── Execution ── */}
        <Card>
          <CardHeader>
            <CardTitle>Execution</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <NumberField id="entryPrice" label="Entry price" register={register} error={err(errors, "entryPrice")} />
            {closed && <NumberField id="exitPrice" label="Exit price" register={register} error={err(errors, "exitPrice")} />}
            <NumberField
              id="quantity"
              label={isLots ? "Lot size" : "Quantity"}
              register={register}
              error={err(errors, "quantity")}
              placeholder={isLots ? "0.10" : "0.5"}
            />
            <NumberField id="leverage" label="Leverage" register={register} error={err(errors, "leverage")} placeholder="e.g. 10" hint="Optional" />
            <NumberField id="fees" label={`Fees (${currency})`} register={register} error={err(errors, "fees")} placeholder="0.00" />
            <NumberField
              id="contractSize"
              label="Contract size"
              register={register}
              error={err(errors, "contractSize")}
              placeholder={String(DEFAULT_CONTRACT_SIZE[v.marketType])}
              hint={isLots ? "Units per lot" : "Leave blank for 1"}
            />
          </CardContent>
        </Card>

        {/* ── Risk ── */}
        <Card>
          <CardHeader>
            <CardTitle>Risk plan</CardTitle>
            <CardDescription>Leave risk empty and it&apos;s worked out from your stop loss.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <NumberField id="stopLoss" label="Stop loss" register={register} error={err(errors, "stopLoss")} hint="Optional" />
            <NumberField id="takeProfit" label="Target / take profit" register={register} error={err(errors, "takeProfit")} hint="Optional" />
            <FormField label="Risk" htmlFor="riskType" error={err(errors, "riskType")}>
              <Controller
                control={control}
                name="riskType"
                render={({ field }) => (
                  <Segmented
                    ariaLabel="Risk type"
                    value={field.value}
                    onChange={(val) => {
                      field.onChange(val);
                      if (!val) setValue("riskValue", "");
                    }}
                    options={[
                      { value: "", label: "From SL" },
                      { value: "AMOUNT", label: `$ amount` },
                      { value: "PERCENT", label: "% of balance" },
                    ]}
                  />
                )}
              />
            </FormField>
            {v.riskType ? (
              <NumberField
                id="riskValue"
                label={v.riskType === "PERCENT" ? "Risk %" : `Risk (${currency})`}
                register={register}
                error={err(errors, "riskValue")}
                placeholder={v.riskType === "PERCENT" ? "1" : "50"}
              />
            ) : (
              <div className="hidden sm:block" />
            )}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-3 text-sm sm:col-span-2">
              <div>
                <p className="text-xs text-muted-foreground">Planned R:R</p>
                <p className="font-semibold tabular-nums">{formatRR(preview.riskReward)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risk amount</p>
                <p className="font-semibold tabular-nums">
                  {preview.riskAmount !== null ? formatMoney(preview.riskAmount, currency) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Psychology & setup ── */}
        <Card>
          <CardHeader>
            <CardTitle>Setup &amp; psychology</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <EmotionField control={control} name="emotionBefore" label="Emotion before" />
            <EmotionField control={control} name="emotionAfter" label="Emotion after" />
            <FormField label="Strategy" htmlFor="strategy" error={err(errors, "strategy")}>
              <Input id="strategy" list="strategy-list" placeholder="e.g. Breakout retest" {...register("strategy")} />
              <datalist id="strategy-list">{meta?.strategies.map((s) => <option key={s} value={s} />)}</datalist>
            </FormField>
            <FormField label="Timeframe" htmlFor="timeframe" error={err(errors, "timeframe")}>
              <Input id="timeframe" list="tf-list" placeholder="15m, 1h, 4h…" {...register("timeframe")} />
              <datalist id="tf-list">{TIMEFRAMES.map((t) => <option key={t} value={t} />)}</datalist>
            </FormField>
            <FormField label="Why I entered" htmlFor="setup" error={err(errors, "setup")} className="sm:col-span-2">
              <Textarea id="setup" rows={3} placeholder="Setup, confluence, trigger…" {...register("setup")} />
            </FormField>
            <FormField label="Tags" htmlFor="tags" error={err(errors, "tags")} className="sm:col-span-2" hint="Enter or comma to add">
              <Controller
                control={control}
                name="tags"
                render={({ field }) => <TagsInput id="tags" value={field.value} onChange={field.onChange} suggestions={meta?.tags} />}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* ── Review ── */}
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField label="Mistakes / lessons" htmlFor="mistakes" error={err(errors, "mistakes")}>
              <Textarea id="mistakes" rows={3} placeholder="What would you do differently?" {...register("mistakes")} />
            </FormField>
            <FormField label="Notes" htmlFor="notes" error={err(errors, "notes")}>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </FormField>
            <FormField label="Chart screenshot" htmlFor="screenshot">
              <Controller
                control={control}
                name="screenshotPath"
                render={({ field }) => <ScreenshotUpload value={field.value} onChange={field.onChange} />}
              />
            </FormField>
          </CardContent>
        </Card>
      </div>

      {/* ── Result sidebar (sticky on desktop) ── */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>{closed ? "Result" : "Open position"}</CardTitle>
            {!closed && <CardDescription>P&amp;L is calculated when you close the trade.</CardDescription>}
          </CardHeader>
          {closed && (
            <CardContent className="grid gap-4">
              <div className="rounded-lg bg-muted/60 p-4 text-center">
                <p className="text-xs text-muted-foreground">Net P&amp;L {v.overridePnl ? "(manual)" : "(estimate)"}</p>
                <p className={cn("text-3xl font-semibold tabular-nums", pnlClass(shownNet))}>
                  {shownNet === null ? "—" : formatMoney(shownNet, currency, { signed: true })}
                </p>
                {!v.overridePnl && preview.grossPnl !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gross {formatMoney(preview.grossPnl, currency, { signed: true })} · fees {formatMoney(v.fees || 0, currency)}
                  </p>
                )}
                {preview.rMultiple !== null && !v.overridePnl && (
                  <p className="mt-1 text-xs text-muted-foreground">{preview.rMultiple.toFixed(2)}R</p>
                )}
              </div>

              <FormField label="Result" htmlFor="result" hint={v.result === "AUTO" && autoResult ? `Auto: ${RESULT_META[autoResult].label}` : undefined}>
                <Controller
                  control={control}
                  name="result"
                  render={({ field }) => (
                    <Segmented
                      ariaLabel="Result"
                      size="sm"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "AUTO", label: "Auto" },
                        { value: "PROFIT", label: "✅", tone: "profit" },
                        { value: "LOSS", label: "❌", tone: "loss" },
                        { value: "BREAKEVEN", label: "BE" },
                      ]}
                    />
                  )}
                />
              </FormField>

              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Checkbox id="targetHit" label="🎯 Target hit" {...register("targetHit")} />
                <Checkbox id="slHit" label="🛑 SL hit" {...register("slHit")} />
              </div>
              {errors.slHit && <p className="-mt-2 text-xs text-destructive">{errors.slHit.message}</p>}

              <div className="grid gap-2 border-t pt-4">
                <Checkbox id="overridePnl" label="Override P&L manually" {...register("overridePnl")} />
                {v.overridePnl && (
                  <FormField label={`Net P&L (${currency})`} htmlFor="manualNetPnl" error={err(errors, "manualNetPnl")}>
                    <Input id="manualNetPnl" inputMode="decimal" placeholder="-25.50" {...register("manualNetPnl")} />
                  </FormField>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur md:bottom-0 md:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3 md:px-8">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!isEdit && !accounts.length}>
            {isEdit ? "Save changes" : "Save trade"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  register,
  error,
  placeholder,
  hint,
}: {
  id: keyof TradeFormValues;
  label: string;
  register: UseFormRegister<TradeFormValues>;
  error?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint}>
      <Input id={id} inputMode="decimal" autoComplete="off" placeholder={placeholder} aria-invalid={!!error} {...register(id)} />
    </FormField>
  );
}

function EmotionField({
  control,
  name,
  label,
}: {
  control: Control<TradeFormValues>;
  name: "emotionBefore" | "emotionAfter";
  label: string;
}) {
  return (
    <FormField label={label} htmlFor={name}>
      <Controller control={control} name={name} render={({ field }) => <EmotionSelect id={name} value={field.value} onChange={field.onChange} />} />
    </FormField>
  );
}
