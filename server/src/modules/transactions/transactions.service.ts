import { Prisma, TradeStatus, TransactionType, type Transaction } from "@prisma/client";
import { computeBalance } from "../../domain/account-stats";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/http-error";
import { toDecimal } from "../../utils/money";
import { findOwnedAccount } from "../accounts/accounts.service";
import { lockAccount, recomputeAccountBalances } from "../trades/balance.service";
import type { CreateTransactionInput, ListTransactionsQuery } from "./transactions.schema";

function serialize(t: Transaction) {
  return {
    id: t.id,
    accountId: t.accountId,
    type: t.type,
    amount: t.amount.toFixed(2),
    note: t.note,
    occurredAt: t.occurredAt,
    createdAt: t.createdAt,
  };
}

/** Current balance computed inside a DB transaction (so it sees the locked state). */
async function balanceWithin(tx: Prisma.TransactionClient, accountId: string, initialBalance: Prisma.Decimal) {
  const [deposits, withdrawals, pnl] = await Promise.all([
    tx.transaction.aggregate({ where: { accountId, type: TransactionType.DEPOSIT }, _sum: { amount: true } }),
    tx.transaction.aggregate({ where: { accountId, type: TransactionType.WITHDRAWAL }, _sum: { amount: true } }),
    tx.trade.aggregate({ where: { accountId, status: TradeStatus.CLOSED }, _sum: { netPnl: true } }),
  ]);
  return computeBalance({
    initialBalance,
    totalDeposits: toDecimal(deposits._sum.amount),
    totalWithdrawals: toDecimal(withdrawals._sum.amount),
    closedNetPnl: toDecimal(pnl._sum.netPnl),
  });
}

export const transactionsService = {
  async list(userId: string, query: ListTransactionsQuery) {
    const where: Prisma.TransactionWhereInput = { userId };
    if (query.accountId) where.accountId = query.accountId;
    if (query.type) where.type = query.type;

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map(serialize),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  },

  async create(userId: string, input: CreateTransactionInput) {
    const account = await findOwnedAccount(userId, input.accountId);
    if (account.isArchived) throw HttpError.unprocessable("Can't add transactions to an archived account");

    const created = await prisma.$transaction(async (tx) => {
      // Lock the account row so concurrent writes can't both pass the balance check.
      await lockAccount(tx, account.id);
      if (input.type === TransactionType.WITHDRAWAL) {
        const balance = await balanceWithin(tx, account.id, account.initialBalance);
        if (new Prisma.Decimal(input.amount).gt(balance)) {
          throw HttpError.unprocessable(
            `Withdrawal exceeds current balance (${balance.toFixed(2)} ${account.currency})`,
          );
        }
      }

      const row = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: input.type,
          amount: input.amount,
          note: input.note,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
      await recomputeAccountBalances(tx, account.id); // shifts balanceAfter of later trades
      return row;
    });

    return serialize(created);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw HttpError.notFound("Transaction not found");
    await prisma.$transaction(async (tx) => {
      await lockAccount(tx, existing.accountId);
      await tx.transaction.delete({ where: { id } });
      await recomputeAccountBalances(tx, existing.accountId);
    });
  },
};
