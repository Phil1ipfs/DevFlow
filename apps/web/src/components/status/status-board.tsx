"use client";

import { useQuery } from "@/lib/query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { healthQuery } from "@/lib/api/health";
import { cn } from "@/lib/utils";
import { deriveSystemState, STATE_LABEL } from "./health-state";
import { StatusDot } from "./status-dot";

export function StatusBoard() {
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt, errorUpdatedAt } = useQuery(healthQuery);

  const apiDown = error !== null;
  const { rows, summary } = deriveSystemState(data, isPending, apiDown);
  const checkedAt = Math.max(dataUpdatedAt, errorUpdatedAt);

  return (
    <section aria-labelledby="status-heading" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 id="status-heading" className="text-2xl font-semibold tracking-tight">
            System status
          </h1>
          <p className="text-sm text-muted-foreground">Live connectivity between the web app, the API and the database.</p>
        </div>
        <Button variant="outline" size="lg" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw data-icon="inline-start" className={cn(isFetching && "animate-spin")} />
          {isFetching ? "Checking…" : "Check now"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div role="status" aria-live="polite" className="flex items-center gap-3 border-b bg-muted/50 px-4 py-3.5 sm:px-5">
          <StatusDot state={summary.tone} />
          <p className="text-sm font-medium">{summary.title}</p>
        </div>

        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <StatusDot state={row.state} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
              </div>
              {row.meta && (
                <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">{row.meta}</span>
              )}
              <span className="w-24 text-right text-sm text-muted-foreground">{STATE_LABEL[row.state]}</span>
            </li>
          ))}
        </ul>
      </div>

      {apiDown && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm sm:px-5">
          <p className="font-medium">{error.message}</p>
          <p className="mt-1 text-muted-foreground">
            Start it from <code className="font-mono text-xs">apps/api</code> with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">dotnet run --project src/DevFlow.Api</code>
            , then check again.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {checkedAt > 0 ? (
          <>
            Last checked{" "}
            <time dateTime={new Date(checkedAt).toISOString()}>{new Date(checkedAt).toLocaleTimeString()}</time> ·
            refreshes every 15 seconds
          </>
        ) : (
          "Running first check…"
        )}
      </p>
    </section>
  );
}
