import { Router } from "express";
import { tradesController } from "../trades/trades.controller";
import { transactionsController } from "../transactions/transactions.controller";
import { accountsController } from "./accounts.controller";

export const accountsRouter = Router();

accountsRouter.get("/", accountsController.list);
accountsRouter.post("/", accountsController.create);
accountsRouter.get("/:id", accountsController.get);
accountsRouter.patch("/:id", accountsController.update);
accountsRouter.delete("/:id", accountsController.remove);
accountsRouter.post("/:id/archive", accountsController.archive);
accountsRouter.post("/:id/unarchive", accountsController.unarchive);

// Nested routes
accountsRouter.get("/:id/transactions", transactionsController.listForAccount);
accountsRouter.get("/:id/trades", tradesController.listForAccount);
accountsRouter.post("/:id/trades", tradesController.createForAccount);
