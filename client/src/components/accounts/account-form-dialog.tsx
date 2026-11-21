"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounts";
import { useMe } from "@/hooks/use-me";
import { CURRENCIES, PLATFORMS } from "@/lib/constants";
import { accountFormSchema, type AccountFormValues } from "@/lib/validations/account";
import type { JournalAccount } from "@/types/api";

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this account, otherwise it creates one. */
  account?: JournalAccount;
}

const emptyValues: AccountFormValues = { name: "", platform: "BINANCE", initialBalance: "", currency: "USD", notes: "" };

function toFormValues(account?: JournalAccount, defaultCurrency = "USD"): AccountFormValues {
  if (!account) return { ...emptyValues, currency: defaultCurrency };
  return {
    name: account.name,
    platform: account.platform,
    initialBalance: account.initialBalance,
    currency: account.currency,
    notes: account.notes ?? "",
  };
}

export function AccountFormDialog({ open, onOpenChange, account }: AccountFormDialogProps) {
  const isEdit = Boolean(account);
  const { data: me } = useMe();
  const create = useCreateAccount();
  const update = useUpdateAccount(account?.id ?? "");
  const mutation = isEdit ? update : create;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: toFormValues(account),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(toFormValues(account, me?.currency));
  }, [open, account, reset, me?.currency]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // Error toast is shown by the global MutationCache handler; keep the dialog open.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "New journal account"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Changing the initial balance recalculates the current balance." : "One account per exchange, broker or strategy."}
          </DialogDescription>
        </DialogHeader>

        <form id="account-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField label="Account name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Binance Futures" autoFocus aria-invalid={!!errors.name} {...register("name")} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Platform / type" htmlFor="platform" error={errors.platform?.message}>
              <Controller
                control={control}
                name="platform"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="platform" aria-invalid={!!errors.platform}>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Currency" htmlFor="currency" error={errors.currency?.message}>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="currency" aria-invalid={!!errors.currency}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField label="Initial balance" htmlFor="initialBalance" error={errors.initialBalance?.message}>
            <Input
              id="initialBalance"
              inputMode="decimal"
              placeholder="1000.00"
              aria-invalid={!!errors.initialBalance}
              {...register("initialBalance")}
            />
          </FormField>

          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message} hint="Optional">
            <Textarea id="notes" rows={3} placeholder="Rules, leverage limits, purpose…" {...register("notes")} />
          </FormField>
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="account-form" loading={mutation.isPending}>
            {isEdit ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
