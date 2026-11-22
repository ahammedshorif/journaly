import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { idParamSchema } from "../../utils/validation";
import { createGoalSchema, updateGoalSchema } from "./goals.schema";
import { goalsService } from "./goals.service";

export const goalsController = {
  async list(req: Request, res: Response) {
    res.json({ data: await goalsService.list(getUser(req).id) });
  },
  async upsert(req: Request, res: Response) {
    res.status(201).json({ data: await goalsService.upsert(getUser(req).id, createGoalSchema.parse(req.body)) });
  },
  async update(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await goalsService.update(getUser(req).id, id, updateGoalSchema.parse(req.body)) });
  },
  async remove(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    await goalsService.remove(getUser(req).id, id);
    res.status(204).end();
  },
};
