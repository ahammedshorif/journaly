"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteAccount, useSetAccountArchived } from "@/hooks/use-accounts";
import type { JournalAccount } from "@/types/api";
import { AccountFormDialog } from "./account-form-dialog";

interface Props {
  account: JournalAccount;
  onDeleted?: () => void;
  triggerVariant?: "ghost" | "outline";
}

export function AccountActionsMenu({ account, onDeleted, triggerVariant = "ghost" }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const setArchived = useSetAccountArchived();
  const remove = useDeleteAccount();

  const tradeCount = account.stats.closedTrades;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={triggerVariant}
            size="icon"
            aria-label={`Actions for ${account.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {account.isArchived ? (
            <DropdownMenuItem onSelect={() => setArchived.mutate({ id: account.id, archived: false })}>
              <ArchiveRestore /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
              <Archive /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountFormDialog open={editOpen} onOpenChange={setEditOpen} account={account} />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive "${account.name}"?`}
        description="It'll be hidden from your active accounts and you won't be able to add new transactions. All data is kept and you can restore it any time."
        confirmLabel="Archive"
        loading={setArchived.isPending}
        onConfirm={async () => {
          await setArchived.mutateAsync({ id: account.id, archived: true });
          setArchiveOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        destructive
        title={`Delete "${account.name}" permanently?`}
        description={
          <>
            This deletes the account, <strong>all of its trades{tradeCount ? ` (${tradeCount})` : ""}</strong> and all
            deposits/withdrawals. This can&apos;t be undone — archive it instead if you only want to hide it.
          </>
        }
        confirmLabel="Delete forever"
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(account.id);
          setDeleteOpen(false);
          onDeleted?.();
        }}
      />
    </>
  );
}
