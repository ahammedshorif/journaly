"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useUpdateMe } from "@/hooks/use-me";
import { CURRENCIES } from "@/lib/constants";
import type { ThemePreference } from "@/types/api";

function allTimeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

const THEME_TO_NEXT: Record<ThemePreference, string> = { SYSTEM: "system", LIGHT: "light", DARK: "dark" };

export default function SettingsPage() {
  const { data: me, isPending: isLoading } = useMe();
  const update = useUpdateMe();
  const { setTheme } = useTheme();
  const zones = useMemo(allTimeZones, []);
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const schema = useMemo(
    () =>
      z.object({
        currency: z.string().regex(/^[A-Z]{3,5}$/),
        timezone: z.string().refine((tz) => tz === "UTC" || zones.includes(tz), "Pick a timezone from the list"),
        theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
      }),
    [zones],
  );
  type Values = z.infer<typeof schema>;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currency: "USD", timezone: "UTC", theme: "SYSTEM" } });

  useEffect(() => {
    if (me) reset({ currency: me.currency, timezone: me.timezone, theme: me.theme });
  }, [me, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const user = await update.mutateAsync(v);
      setTheme(THEME_TO_NEXT[user.theme]);
      reset({ currency: user.currency, timezone: user.timezone, theme: user.theme });
    } catch {
      // toast handled globally
    }
  });

  return (
    <>
      <PageHeader title="Settings" description="Preferences are saved to your profile and follow you across devices." />
      <Card className="max-w-2xl">
        <form onSubmit={onSubmit} noValidate>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>The timezone decides what counts as &quot;today&quot;, &quot;this week&quot; and the hour charts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {isLoading ? (
              <>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </>
            ) : (
              <>
                <FormField label="Default currency" htmlFor="currency" hint="Pre-selected for new accounts. Each account keeps its own currency.">
                  <Controller
                    control={control}
                    name="currency"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="currency" className="sm:w-48">
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

                <FormField label="Timezone" htmlFor="timezone" error={errors.timezone?.message}>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id="timezone" list="tz-list" autoComplete="off" className="sm:w-72" {...register("timezone")} />
                    {browserTz && (
                      <Button type="button" variant="outline" onClick={() => setValue("timezone", browserTz, { shouldDirty: true, shouldValidate: true })}>
                        Use this device ({browserTz})
                      </Button>
                    )}
                  </div>
                  <datalist id="tz-list">
                    {zones.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </FormField>

                <FormField label="Theme" htmlFor="theme">
                  <Controller
                    control={control}
                    name="theme"
                    render={({ field }) => (
                      <Segmented
                        ariaLabel="Theme"
                        className="sm:w-96"
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v);
                          setTheme(THEME_TO_NEXT[v]); // preview immediately
                        }}
                        options={[
                          { value: "LIGHT", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-4" /> Light</span> },
                          { value: "DARK", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-4" /> Dark</span> },
                          { value: "SYSTEM", label: <span className="inline-flex items-center gap-1.5"><Laptop className="size-4" /> System</span> },
                        ]}
                      />
                    )}
                  />
                </FormField>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!isDirty} loading={update.isPending}>
              Save settings
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
