import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { positiveMoney } from "../../utils/money";
import { optionalText } from "../../utils/validation";

export const createTransactionSchema = z
  .object({
    accountId: z.uuid("Invalid account id"),
    type: z.enum(TransactionType),
    amount: positiveMoney,
    note: optionalText(500),
    occurredAt: z.coerce
      .date()
      .refine((d) => d.getTime() <= Date.now() + 60_000, "Date can't be in the future")
      .optional(),
  })
  .strict();

export const listTransactionsQuerySchema = z.object({
  accountId: z.uuid().optional(),
  type: z.enum(TransactionType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
