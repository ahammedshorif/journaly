import { z } from "zod";
import { moneyInput } from "./common";

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(100, "Max 100 characters"),
  platform: z.enum(["BINANCE", "BYBIT", "FOREX", "GOLD", "OTHER"], { error: "Pick a platform" }),
  initialBalance: moneyInput({ allowZero: true }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3,5}$/, "3–5 letter code"),
  notes: z.string().trim().max(2000, "Max 2000 characters").optional(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;
