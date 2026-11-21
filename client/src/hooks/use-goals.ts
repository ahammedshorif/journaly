"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { Goal, GoalsResponse, GoalType } from "@/types/api";

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: () => api.get<GoalsResponse>("/goals"),
    refetchInterval: 60_000, // keep daily-loss warnings fresh
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: GoalType; amount: string; accountId: string | null }) => api.post<Goal>("/goals", input),
    onSuccess: () => {
      toast.success("Goal saved");
      return qc.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => {
      toast.success("Goal removed");
      return qc.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
}
