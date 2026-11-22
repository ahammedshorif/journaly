import { Router } from "express";
import { goalsController } from "./goals.controller";

export const goalsRouter = Router();

goalsRouter.get("/", goalsController.list);
goalsRouter.post("/", goalsController.upsert);
goalsRouter.patch("/:id", goalsController.update);
goalsRouter.delete("/:id", goalsController.remove);
