import { z } from "zod";
import { breakdownQuerySchema } from "../analytics/analytics.schema";
import { listTradesQuerySchema } from "../trades/trades.schema";

export const exportBaseSchema = z.object({
  type: z.enum(["trades", "analytics"]),
  format: z.enum(["csv", "pdf"]),
});

export const tradesExportQuerySchema = listTradesQuerySchema.omit({ page: true, pageSize: true });
export const analyticsExportQuerySchema = breakdownQuerySchema;

export const MAX_EXPORT_TRADES = 10_000;
