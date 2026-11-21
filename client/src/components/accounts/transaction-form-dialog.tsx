"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { formatMoney } from "@/lib/format";
import { transactionFormSchema, type TransactionFormValues } from "@/lib/validations/transaction";
import type { JournalAccount, TransactionType } from "@/types/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: JournalAccount;
  type: TransactionType;
}

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local"> */
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function TransactionFormDialog({ open, onOpenChange, account, type }: Props) {
  const create = useCreateTransaction();
  const isDeposit = type === "DEPOSIT";

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { type, amount: "", note: "", occurredAt: nowLocal() },
  });

  useEffect(() => {
    if (open) reset({ type, amount: "", note: "", occurredAt: nowLocal() });
  }, [open, type, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // Friendly client-side check; the server enforces it authoritatively.
    if (!isDeposit && Number(values.amount) > Number(account.stats.currentBalance)) {
      setError("amount", { message: "Withdrawal exceeds current balance" });
      return;
    }
    try {
      await create.mutateAsync({ ...values, accountId: account.id });
      onOpenChange(false);
    } catch {
      // toast handled globally
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isDeposit ? "Add deposit" : "Record withdrawal"}</DialogTitle>
          <DialogDescription>
            {account.name} · current balance {formatMoney(account.stats.currentBalance, account.currency)}
          </DialogDescription>
        </DialogHeader>

        <form id="tx-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" {...register("type")} />
          <FormField label={`Amount (${account.currency})`} htmlFor="amount" error={errors.amount?.message}>
            <Input id="amount" inputMode="decimal" placeholder="0.00" autoFocus aria-invalid={!!errors.amount} {...register("amount")} />
          </FormField>
          <FormField label="Date" htmlFor="occurredAt" error={errors.occurredAt?.message}>
            <Input id="occurredAt" type="datetime-local" max={nowLocal()} {...register("occurredAt")} />
          </FormField>
          <FormField label="Note" htmlFor="note" error={errors.note?.message} hint="Optional">
            <Input id="note" placeholder={isDeposit ? "e.g. Monthly top-up" : "e.g. Took profits"} {...register("note")} />
          </FormField>
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="tx-form" loading={create.isPending}>
            {isDeposit ? "Add deposit" : "Withdraw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
