import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { idParamSchema } from "../../utils/validation";
import { createTradeBodySchema, listTradesQuerySchema, tradeInputSchema } from "./trades.schema";
import { tradesService } from "./trades.service";

export const tradesController = {
  /** GET /trades — all accounts (optionally ?accountId=) */
  async list(req: Request, res: Response) {
    const query = listTradesQuerySchema.parse(req.query);
    res.json({ data: await tradesService.list(getUser(req).id, query) });
  },

  /** GET /accounts/:id/trades */
  async listForAccount(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const query = listTradesQuerySchema.parse({ ...req.query, accountId: id });
    res.json({ data: await tradesService.list(getUser(req).id, query) });
  },

  async meta(req: Request, res: Response) {
    res.json({ data: await tradesService.meta(getUser(req).id) });
  },

  async get(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await tradesService.get(getUser(req).id, id) });
  },

  /** POST /accounts/:id/trades */
  async createForAccount(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = tradeInputSchema.parse(req.body);
    res.status(201).json({ data: await tradesService.create(getUser(req).id, id, input) });
  },

  /** POST /trades  { accountId, ...trade } */
  async create(req: Request, res: Response) {
    const { accountId, ...rest } = (req.body ?? {}) as Record<string, unknown>;
    const { accountId: id } = createTradeBodySchema.parse({ accountId });
    const input = tradeInputSchema.parse(rest);
    res.status(201).json({ data: await tradesService.create(getUser(req).id, id, input) });
  },

  async update(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await tradesService.update(getUser(req).id, id, req.body ?? {}) });
  },

  async remove(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    await tradesService.remove(getUser(req).id, id);
    res.status(204).end();
  },
};
