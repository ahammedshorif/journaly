import { z } from "zod";
import { moneyInput } from "./common";

export const transactionFormSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: moneyInput(),
  note: z.string().trim().max(500, "Max 500 characters").optional(),
  /** value of an <input type="datetime-local"> */
  occurredAt: z
    .string()
    .optional()
    .refine((v) => !v || new Date(v).getTime() <= Date.now() + 60_000, "Date can't be in the future"),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
