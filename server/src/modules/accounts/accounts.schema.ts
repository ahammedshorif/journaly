import { Platform } from "@prisma/client";
import { z } from "zod";
import { nonNegativeMoney } from "../../utils/money";
import { currencySchema, optionalText } from "../../utils/validation";

export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    platform: z.enum(Platform),
    initialBalance: nonNegativeMoney,
    currency: currencySchema.default("USD"),
    notes: optionalText(2000),
  })
  .strict();

export const updateAccountSchema = createAccountSchema.partial().strict();

export const listAccountsQuerySchema = z.object({
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
