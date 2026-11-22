import type { JournalAccount, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/http-error";
import { lockAccount, recomputeAccountBalances } from "../trades/balance.service";
import { getStatsForAccount, getStatsForAccounts } from "./account-stats.service";
import type { CreateAccountInput, ListAccountsQuery, UpdateAccountInput } from "./accounts.schema";

function serialize(account: JournalAccount) {
  return {
    id: account.id,
    name: account.name,
    platform: account.platform,
    initialBalance: account.initialBalance.toFixed(2),
    currency: account.currency,
    notes: account.notes,
    isArchived: account.isArchived,
    archivedAt: account.archivedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/** Throws 404 if the account doesn't exist OR belongs to another user (no existence leak). */
export async function findOwnedAccount(userId: string, id: string) {
  const account = await prisma.journalAccount.findFirst({ where: { id, userId } });
  if (!account) throw HttpError.notFound("Account not found");
  return account;
}

export const accountsService = {
  async list(userId: string, query: ListAccountsQuery) {
    const where: Prisma.JournalAccountWhereInput = { userId };
    if (query.status === "active") where.isArchived = false;
    if (query.status === "archived") where.isArchived = true;

    const accounts = await prisma.journalAccount.findMany({ where, orderBy: { createdAt: "asc" } });
    const stats = await getStatsForAccounts(userId, accounts);
    return accounts.map((a) => ({ ...serialize(a), stats: stats.get(a.id)! }));
  },

  async get(userId: string, id: string) {
    const account = await findOwnedAccount(userId, id);
    const stats = await getStatsForAccount(userId, account);
    return { ...serialize(account), stats };
  },

  async create(userId: string, input: CreateAccountInput) {
    const account = await prisma.journalAccount.create({ data: { ...input, userId } });
    const stats = await getStatsForAccount(userId, account);
    return { ...serialize(account), stats };
  },

  async update(userId: string, id: string, input: UpdateAccountInput) {
    const before = await findOwnedAccount(userId, id);
    const account = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, id);
      const updated = await tx.journalAccount.update({ where: { id }, data: input });
      // Initial balance shifts every point on the equity curve.
      if (!updated.initialBalance.eq(before.initialBalance)) await recomputeAccountBalances(tx, id);
      return updated;
    });
    const stats = await getStatsForAccount(userId, account);
    return { ...serialize(account), stats };
  },

  async setArchived(userId: string, id: string, archived: boolean) {
    await findOwnedAccount(userId, id);
    const account = await prisma.journalAccount.update({
      where: { id },
      data: { isArchived: archived, archivedAt: archived ? new Date() : null },
    });
    const stats = await getStatsForAccount(userId, account);
    return { ...serialize(account), stats };
  },

  /** Hard delete — trades, transactions and account-scoped goals cascade in the DB. */
  async remove(userId: string, id: string) {
    await findOwnedAccount(userId, id);
    await prisma.journalAccount.delete({ where: { id } });
  },
};
