import type { HealthResult, HealthStatus } from "@/lib/api/health";

export type ComponentState = "operational" | "degraded" | "down" | "unknown" | "checking";

export type ComponentRow = {
  name: string;
  detail: string;
  state: ComponentState;
  meta?: string;
};

export type SystemSummary = { title: string; tone: ComponentState };

export const STATE_LABEL: Record<ComponentState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Unreachable",
  unknown: "Unknown",
  checking: "Checking…",
};

function fromHealthStatus(status: HealthStatus | undefined): ComponentState {
  switch (status) {
    case "Healthy":
      return "operational";
    case "Degraded":
      return "degraded";
    case "Unhealthy":
      return "down";
    default:
      return "unknown";
  }
}

/**
 * Turns the health query result into per-component rows and an overall summary.
 * `apiDown` means the latest attempt got no health report at all (the query has retry off).
 */
export function deriveSystemState(data: HealthResult | undefined, isPending: boolean, apiDown: boolean) {
  const report = apiDown ? undefined : data;
  const database = report?.report.checks.find((check) => check.name === "database");

  const rows: ComponentRow[] = [
    { name: "Web app", detail: "Next.js", state: "operational" },
    {
      name: "API",
      detail: "ASP.NET Core · /api/v1/health",
      state: isPending ? "checking" : apiDown ? "down" : "operational",
      meta: report ? `${Math.round(report.latencyMs)} ms` : undefined,
    },
    {
      name: "Database",
      detail: "PostgreSQL",
      state: isPending ? "checking" : apiDown ? "unknown" : fromHealthStatus(database?.status),
      meta: database ? `${Math.round(database.durationMs)} ms` : undefined,
    },
  ];

  let summary: SystemSummary;
  if (rows.some((row) => row.state === "checking")) summary = { title: "Checking systems…", tone: "checking" };
  else if (apiDown) summary = { title: "Cannot reach the API", tone: "down" };
  else if (rows.some((row) => row.state === "down")) summary = { title: "Partial outage", tone: "down" };
  else if (rows.some((row) => row.state === "degraded")) summary = { title: "Degraded performance", tone: "degraded" };
  else summary = { title: "All systems operational", tone: "operational" };

  return { rows, summary };
}
