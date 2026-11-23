"use client";

import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { AccountCard, AccountCardSkeleton } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/hooks/use-accounts";
import { errorMessage } from "@/lib/api-client";

type Status = "active" | "archived";

export default function AccountsPage() {
  const [status, setStatus] = useState<Status>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: accounts, isPending: isLoading, isError, error, refetch } = useAccounts(status);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Each journal account tracks its own balance, deposits and trades."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New account
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)} className="mb-5">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AccountCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Wallet}
          title="Couldn't load accounts"
          description={errorMessage(error)}
          action={<Button variant="outline" onClick={() => void refetch()}>Try again</Button>}
        />
      ) : !accounts?.length ? (
        status === "active" ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Create your first journal account — e.g. your Binance futures wallet or a forex broker account."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Create account
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Wallet} title="No archived accounts" description="Accounts you archive will show up here." />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      <AccountFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
