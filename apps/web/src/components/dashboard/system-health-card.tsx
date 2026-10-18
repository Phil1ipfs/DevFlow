"use client";

import Link from "next/link";
import { useQuery } from "@/lib/query";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deriveSystemState, STATE_LABEL } from "@/components/status/health-state";
import { StatusDot } from "@/components/status/status-dot";
import { healthQuery } from "@/lib/api/health";

/** The one live widget on the dashboard: real data from GET /api/v1/health. */
export function SystemHealthCard() {
  const { data, error, isPending } = useQuery(healthQuery);
  const { rows, summary } = deriveSystemState(data, isPending, error !== null);
  const services = rows.filter((row) => row.name !== "Web app");

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardDescription>System</CardDescription>
        <CardTitle className="flex items-center gap-2 text-base">
          {isPending ? (
            <Skeleton className="h-5 w-36" />
          ) : (
            <>
              <StatusDot state={summary.tone} />
              {summary.title}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1.5" aria-live="polite">
          {services.map((row) => (
            <li key={row.name} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.name}</span>
              {isPending ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="flex items-center gap-1.5">
                  <StatusDot state={row.state} className="size-2" />
                  {STATE_LABEL[row.state]}
                </span>
              )}
            </li>
          ))}
        </ul>
        <Link
          href="/status"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Status page
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
