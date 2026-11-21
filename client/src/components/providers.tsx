"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
        },
      },
      // Global error toast for every mutation (individual hooks show success toasts).
      // Any successful write can move balances, so derived analytics and goal progress refresh too.
      mutationCache: new MutationCache({
        onError: (err) => toast.error(errorMessage(err)),
        onSuccess: () => {
          void client.invalidateQueries({ queryKey: queryKeys.analytics.all });
          void client.invalidateQueries({ queryKey: queryKeys.goals });
        },
      }),
    });
    return client;
  });

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
