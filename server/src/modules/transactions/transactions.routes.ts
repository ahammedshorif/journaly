import { Router } from "express";
import { transactionsController } from "./transactions.controller";

export const transactionsRouter = Router();

transactionsRouter.get("/", transactionsController.list);
transactionsRouter.post("/", transactionsController.create);
transactionsRouter.delete("/:id", transactionsController.remove);
