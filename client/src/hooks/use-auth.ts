"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useSignInWithGoogle() {
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (next = "/dashboard") => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
    // On success the browser navigates to Google — keep the spinner.
  }, []);

  return { signIn, loading };
}

export function useSignOut() {
  const router = useRouter();
  const qc = useQueryClient();

  return useCallback(async () => {
    await getSupabaseBrowserClient().auth.signOut();
    qc.clear();
    router.replace("/login");
    router.refresh();
  }, [qc, router]);
}
