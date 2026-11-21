"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, errorMessage } from "@/lib/api-client";

interface Props {
  type: "trades" | "analytics";
  /** Current filters / range, forwarded to /export */
  params: Record<string, string | number | undefined>;
  label?: string;
}

export function ExportMenu({ type, params, label = "Export" }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async (format: "csv" | "pdf") => {
    setBusy(true);
    try {
      await api.download("/export", { ...params, type, format });
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" loading={busy}>
          {!busy && <Download />}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run("csv")}>
          <FileSpreadsheet /> CSV (Excel / Sheets)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run("pdf")}>
          <FileText /> PDF report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
