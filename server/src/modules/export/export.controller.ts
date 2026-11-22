import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { analyticsExportQuerySchema, exportBaseSchema, tradesExportQuerySchema } from "./export.schema";
import {
  exportAnalyticsCsv,
  exportAnalyticsPdf,
  exportTradesCsv,
  exportTradesPdf,
  type ExportFile,
} from "./export.service";

/** GET /export?type=trades|analytics&format=csv|pdf&…filters */
export async function exportController(req: Request, res: Response) {
  const userId = getUser(req).id;
  const { type, format } = exportBaseSchema.parse(req.query);
  const filters: Record<string, unknown> = { ...req.query };
  delete filters.type;
  delete filters.format;

  let file: ExportFile;
  if (type === "trades") {
    const q = tradesExportQuerySchema.parse(filters);
    file = format === "csv" ? await exportTradesCsv(userId, q) : await exportTradesPdf(userId, q);
  } else {
    const q = analyticsExportQuerySchema.parse(filters);
    file = format === "csv" ? await exportAnalyticsCsv(userId, q) : await exportAnalyticsPdf(userId, q);
  }

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.body);
}
