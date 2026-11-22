-- AlterTable: contract size (lot multiplier) for P&L calculation
ALTER TABLE "Trade" ADD COLUMN "contractSize" DECIMAL(20,8);

-- AlterTable: remember whether the result was picked manually or derived from P&L
ALTER TABLE "Trade" ADD COLUMN "resultOverridden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: screenshots now live in Supabase Storage; we store the object path
ALTER TABLE "Trade" RENAME COLUMN "screenshotUrl" TO "screenshotPath";
ALTER TABLE "Trade" ALTER COLUMN "screenshotPath" SET DATA TYPE VARCHAR(300);
