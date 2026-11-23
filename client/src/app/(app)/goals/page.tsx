"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Target, Trash2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { GoalProgressBar } from "@/components/goals/goal-progress";
import { RiskWarnings } from "@/components/goals/risk-warnings";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-accounts";
import { useDeleteGoal, useGoals, useSaveGoal } from "@/hooks/use-goals";
import { moneyInput } from "@/lib/validations/common";
import type { Goal, GoalType } from "@/types/api";

const ALL = "__all__";
const schema = z.object({ accountId: z.string(), amount: moneyInput() });
type Values = z.infer<typeof schema>;

const COPY: Record<GoalType, { title: string; description: string; icon: typeof Target; placeholder: string }> = {
  MONTHLY_PROFIT: {
    title: "Monthly profit target",
    description: "Net P&L you're aiming for each calendar month.",
    icon: Target,
    placeholder: "500",
  },
  MAX_DAILY_LOSS: {
    title: "Max daily loss",
    description: "Stop trading when today's net loss reaches this. You'll get a warning at 75%.",
    icon: TrendingDown,
    placeholder: "100",
  },
};

function GoalForm({ type }: { type: GoalType }) {
  const { data: accounts = [] } = useAccounts("active");
  const save = useSaveGoal();
  const copy = COPY[type];
  const Icon = copy.icon;
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { accountId: ALL, amount: "" } });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ type, amount: v.amount, accountId: v.accountId === ALL ? null : v.accountId });
      reset({ accountId: v.accountId, amount: "" });
    } catch {
      // toast handled globally
    }
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4 text-primary" /> {copy.title}
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <FormField label="Applies to" htmlFor={`${type}-account`}>
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${type}-account`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All active accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Amount" htmlFor={`${type}-amount`} error={errors.amount?.message}>
            <Input id={`${type}-amount`} inputMode="decimal" placeholder={copy.placeholder} aria-invalid={!!errors.amount} {...register("amount")} />
          </FormField>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}

export default function GoalsPage() {
  const { data, isPending: isLoading } = useGoals();
  const remove = useDeleteGoal();
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader title="Goals & risk" description="Targets keep you motivated; limits keep you in the game. Saving again for the same account updates the amount." />
      <RiskWarnings className="mb-6" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <GoalForm type="MONTHLY_PROFIT" />
          <GoalForm type="MAX_DAILY_LOSS" />
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Active goals</CardTitle>
            <CardDescription>Progress updates live as you log trades.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : !data?.goals.length ? (
              <EmptyState icon={Target} title="No goals yet" description="Set a monthly target or a daily loss limit on the left." className="py-10" />
            ) : (
              <ul className="divide-y">
                {data.goals.map((g) => (
                  <li key={g.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex-1">
                      <GoalProgressBar goal={g} />
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Remove goal" onClick={() => setToDelete(g)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remove this goal?"
        description="You can set it again any time."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          await remove.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
      />
    </>
  );
}
