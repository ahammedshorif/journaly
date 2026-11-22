import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { idParamSchema } from "../../utils/validation";
import { createAccountSchema, listAccountsQuerySchema, updateAccountSchema } from "./accounts.schema";
import { accountsService } from "./accounts.service";

export const accountsController = {
  async list(req: Request, res: Response) {
    const query = listAccountsQuerySchema.parse(req.query);
    res.json({ data: await accountsService.list(getUser(req).id, query) });
  },

  async get(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await accountsService.get(getUser(req).id, id) });
  },

  async create(req: Request, res: Response) {
    const input = createAccountSchema.parse(req.body);
    res.status(201).json({ data: await accountsService.create(getUser(req).id, input) });
  },

  async update(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = updateAccountSchema.parse(req.body);
    res.json({ data: await accountsService.update(getUser(req).id, id, input) });
  },

  async archive(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await accountsService.setArchived(getUser(req).id, id, true) });
  },

  async unarchive(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await accountsService.setArchived(getUser(req).id, id, false) });
  },

  async remove(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    await accountsService.remove(getUser(req).id, id);
    res.status(204).end();
  },
};
