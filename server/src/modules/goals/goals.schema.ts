import { GoalType } from "@prisma/client";
import { z } from "zod";
import { positiveMoney } from "../../utils/money";

export const createGoalSchema = z
  .object({
    type: z.enum(GoalType),
    amount: positiveMoney,
    /** null / omitted = applies to all active accounts */
    accountId: z.uuid().nullish().transform((v) => v ?? null),
  })
  .strict();

export const updateGoalSchema = z
  .object({
    amount: positiveMoney,
    isActive: z.boolean(),
  })
  .partial()
  .strict();

export type CreateGoalInput = z.output<typeof createGoalSchema>;
export type UpdateGoalInput = z.output<typeof updateGoalSchema>;
