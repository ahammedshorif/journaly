import { z } from "zod";

export const scopeQuerySchema = z.object({
  accountId: z.uuid().optional(),
});

export const rangeQuerySchema = scopeQuerySchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const breakdownQuerySchema = rangeQuerySchema.extend({
  period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
});

export type ScopeQuery = z.output<typeof scopeQuerySchema>;
export type RangeQuery = z.output<typeof rangeQuerySchema>;
export type BreakdownQuery = z.output<typeof breakdownQuerySchema>;
