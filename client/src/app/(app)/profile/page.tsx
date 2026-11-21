"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { initials } from "@/components/layout/user-menu";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignOut } from "@/hooks/use-auth";
import { useMe, useUpdateMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/format";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Max 80 characters"),
  avatarUrl: z.union([z.literal(""), z.url("Must be a valid URL").max(500)]),
});
type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const update = useUpdateMe();
  const signOut = useSignOut();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { name: "", avatarUrl: "" } });

  useEffect(() => {
    if (me) reset({ name: me.name ?? "", avatarUrl: me.avatarUrl ?? "" });
  }, [me, reset]);

  const previewUrl = watch("avatarUrl");

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await update.mutateAsync({ name: values.name, avatarUrl: values.avatarUrl || null });
      reset({ name: user.name ?? "", avatarUrl: user.avatarUrl ?? "" });
    } catch {
      // toast handled globally
    }
  });

  return (
    <>
      <PageHeader title="Profile" description="How you appear in the app. Signed in with Google." />

      <div className="grid max-w-2xl gap-6">
        <Card>
          <form onSubmit={onSubmit} noValidate>
            <CardHeader>
              <CardTitle>Personal info</CardTitle>
              <CardDescription>Changes here don&apos;t affect your Google account.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex items-center gap-4">
                {isLoading ? (
                  <Skeleton className="size-16 rounded-full" />
                ) : (
                  <Avatar className="size-16">
                    {previewUrl && <AvatarImage src={previewUrl} alt="" referrerPolicy="no-referrer" />}
                    <AvatarFallback className="text-lg">{initials(me?.name, me?.email)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0">
                  {isLoading ? (
                    <Skeleton className="h-4 w-48" />
                  ) : (
                    <>
                      <p className="truncate font-medium">{me?.email}</p>
                      <p className="text-xs text-muted-foreground">Member since {me && formatDate(me.createdAt)}</p>
                    </>
                  )}
                </div>
              </div>

              <FormField label="Display name" htmlFor="name" error={errors.name?.message}>
                <Input id="name" disabled={isLoading} aria-invalid={!!errors.name} {...register("name")} />
              </FormField>
              <FormField label="Avatar URL" htmlFor="avatarUrl" error={errors.avatarUrl?.message} hint="Leave empty to show your initials.">
                <Input id="avatarUrl" disabled={isLoading} placeholder="https://…" aria-invalid={!!errors.avatarUrl} {...register("avatarUrl")} />
              </FormField>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={!isDirty} loading={update.isPending}>
                Save changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Sign out of the Trading Journal on this device.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut /> Log out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
