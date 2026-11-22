import { Router } from "express";
import { tradesController } from "./trades.controller";

export const tradesRouter = Router();

tradesRouter.get("/", tradesController.list);
tradesRouter.post("/", tradesController.create);
tradesRouter.get("/meta", tradesController.meta); // before /:id
tradesRouter.get("/:id", tradesController.get);
tradesRouter.patch("/:id", tradesController.update);
tradesRouter.delete("/:id", tradesController.remove);
