import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { idParamSchema } from "../../utils/validation";
import { findOwnedAccount } from "../accounts/accounts.service";
import { createTransactionSchema, listTransactionsQuerySchema } from "./transactions.schema";
import { transactionsService } from "./transactions.service";

export const transactionsController = {
  async list(req: Request, res: Response) {
    const query = listTransactionsQuerySchema.parse(req.query);
    res.json({ data: await transactionsService.list(getUser(req).id, query) });
  },

  /** GET /accounts/:id/transactions */
  async listForAccount(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const userId = getUser(req).id;
    await findOwnedAccount(userId, id);
    const query = listTransactionsQuerySchema.parse({ ...req.query, accountId: id });
    res.json({ data: await transactionsService.list(userId, query) });
  },

  async create(req: Request, res: Response) {
    const input = createTransactionSchema.parse(req.body);
    res.status(201).json({ data: await transactionsService.create(getUser(req).id, input) });
  },

  async remove(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    await transactionsService.remove(getUser(req).id, id);
    res.status(204).end();
  },
};
