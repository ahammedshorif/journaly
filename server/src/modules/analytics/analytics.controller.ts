import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { breakdownQuerySchema, rangeQuerySchema, scopeQuerySchema } from "./analytics.schema";
import { analyticsService } from "./analytics.service";

export const analyticsController = {
  async summary(req: Request, res: Response) {
    res.json({ data: await analyticsService.summary(getUser(req).id, scopeQuerySchema.parse(req.query)) });
  },
  async equityCurve(req: Request, res: Response) {
    res.json({ data: await analyticsService.equityCurve(getUser(req).id, rangeQuerySchema.parse(req.query)) });
  },
  async breakdown(req: Request, res: Response) {
    res.json({ data: await analyticsService.breakdown(getUser(req).id, breakdownQuerySchema.parse(req.query)) });
  },
  async compare(req: Request, res: Response) {
    res.json({ data: await analyticsService.compare(getUser(req).id, rangeQuerySchema.parse(req.query)) });
  },
};
