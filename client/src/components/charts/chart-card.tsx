"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface TableView {
  columns: { label: string; align?: "left" | "right" }[];
  rows: (string | number)[][];
}

interface ChartCardProps {
  title: string;
  description?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  /** Accessible table alternative — every chart gets one */
  table?: TableView;
  actions?: React.ReactNode;
  className?: string;
  height?: number;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  description,
  loading,
  empty,
  emptyText = "No closed trades in this range yet.",
  table,
  actions,
  className,
  height = 260,
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {table && !empty && !loading && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setShowTable((s) => !s)}
              aria-label={showTable ? `Show ${title} as chart` : `Show ${title} as table`}
              title={showTable ? "Chart view" : "Table view"}
            >
              {showTable ? <BarChart3 /> : <Table2 />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton style={{ height }} className="w-full" />
        ) : empty ? (
          <div style={{ height }} className="grid place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : showTable && table ? (
          <div style={{ maxHeight: Math.max(height, 260) }} className="overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  {table.columns.map((c) => (
                    <th key={c.label} className={cn("px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} className={cn("px-3 py-1.5 tabular-nums", table.columns[j]?.align === "right" && "text-right")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
