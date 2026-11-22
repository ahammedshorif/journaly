import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { accountsRouter } from "../modules/accounts/accounts.routes";
import { analyticsRouter } from "../modules/analytics/analytics.routes";
import { exportController } from "../modules/export/export.controller";
import { goalsRouter } from "../modules/goals/goals.routes";
import { tradesRouter } from "../modules/trades/trades.routes";
import { transactionsRouter } from "../modules/transactions/transactions.routes";
import { usersRouter } from "../modules/users/users.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Everything below requires a valid Supabase access token.
apiRouter.use(requireAuth);
apiRouter.use("/me", usersRouter);
apiRouter.use("/accounts", accountsRouter);
apiRouter.use("/transactions", transactionsRouter);
apiRouter.use("/trades", tradesRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/goals", goalsRouter);
apiRouter.get("/export", exportController);
