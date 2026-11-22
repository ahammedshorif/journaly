import { Router } from "express";
import { analyticsController } from "./analytics.controller";

export const analyticsRouter = Router();

analyticsRouter.get("/summary", analyticsController.summary);
analyticsRouter.get("/equity-curve", analyticsController.equityCurve);
analyticsRouter.get("/breakdown", analyticsController.breakdown);
analyticsRouter.get("/compare", analyticsController.compare);
