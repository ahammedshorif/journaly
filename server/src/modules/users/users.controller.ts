import type { Request, Response } from "express";
import { getUser } from "../../middleware/auth";
import { updateMeSchema } from "./users.schema";
import { usersService } from "./users.service";

export const usersController = {
  async getMe(req: Request, res: Response) {
    const user = await usersService.getMe(getUser(req).id);
    res.json({ data: user });
  },

  async updateMe(req: Request, res: Response) {
    const input = updateMeSchema.parse(req.body);
    const user = await usersService.updateMe(getUser(req).id, input);
    res.json({ data: user });
  },
};
