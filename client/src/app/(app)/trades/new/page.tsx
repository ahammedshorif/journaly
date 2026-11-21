import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RiskWarnings } from "@/components/goals/risk-warnings";
import { TradeForm } from "@/components/trades/trade-form";

export const metadata: Metadata = { title: "Add trade" };

export default async function NewTradePage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const { accountId } = await searchParams;
  return (
    <>
      <Link href="/trades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Trades
      </Link>
      <PageHeader title="Add trade" description="P&L, R:R and the account balance are calculated for you." />
      <RiskWarnings className="mb-5" />
      <TradeForm defaultAccountId={accountId} />
    </>
  );
}
