"use client";

import { useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** A chart with a "view as table" switch, so every value is reachable without hovering. */
export function ChartCard({
  title,
  description,
  chart,
  table,
  className,
}: {
  title: string;
  description?: string;
  chart: ReactNode;
  table: { columns: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <Button variant="ghost" size="sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
          <Table2 data-icon="inline-start" />
          {showTable ? "Chart" : "Table"}
        </Button>
      </CardHeader>
      <CardContent>
        {showTable ? (
          <div className="max-h-72 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={i === 0 ? "px-3 py-2 font-medium" : "px-3 py-2 text-right font-medium"}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} className={i === 0 ? "px-3 py-1.5" : "px-3 py-1.5 text-right tabular-nums"}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          chart
        )}
      </CardContent>
    </Card>
  );
}

/** Headline number: label, value (proportional figures, as the spec asks), optional note. */
export function StatTile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warning" }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {note && <p className={tone === "warning" ? "text-xs font-medium text-warning" : "text-xs text-muted-foreground"}>{note}</p>}
      </CardContent>
    </Card>
  );
}
