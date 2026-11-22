import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/http-error";
import type { UpdateMeInput } from "./users.schema";

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  currency: true,
  timezone: true,
  theme: true,
  createdAt: true,
} as const;

export const usersService = {
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw HttpError.notFound("User not found");
    return user;
  },

  async updateMe(userId: string, input: UpdateMeInput) {
    return prisma.user.update({ where: { id: userId }, data: input, select: userSelect });
  },
};
