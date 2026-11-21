"use client";

import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TradeForm } from "@/components/trades/trade-form";
import { TradesTableSkeleton } from "@/components/trades/trades-table";
import { useTrade } from "@/hooks/use-trades";

export default function EditTradePage() {
  const { id } = useParams<{ id: string }>();
  const { data: trade, isLoading, isError } = useTrade(id);

  if (isError) return <EmptyState icon={SearchX} title="Trade not found" description="It may have been deleted." />;

  return (
    <>
      <Link href={`/trades/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to trade
      </Link>
      <PageHeader title={trade ? `Edit ${trade.symbol}` : "Edit trade"} />
      {isLoading || !trade ? <TradesTableSkeleton rows={4} /> : <TradeForm trade={trade} />}
    </>
  );
}
