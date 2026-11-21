"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@/types/api";

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.get<User>("/me") });
}

export type UpdateMeInput = Partial<Pick<User, "name" | "avatarUrl" | "currency" | "timezone" | "theme">>;

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMeInput) => api.patch<User>("/me", input),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.me, user);
      toast.success("Profile updated");
    },
  });
}
