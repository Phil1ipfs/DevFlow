import { queryOptions } from "@tanstack/react-query";

export type HealthStatus = "Healthy" | "Degraded" | "Unhealthy";

export type HealthCheckEntry = {
  name: string;
  status: HealthStatus;
  description: string | null;
  durationMs: number;
};

/** Mirrors DevFlow.Api.Health.HealthResponse. */
export type HealthReport = {
  status: HealthStatus;
  timestamp: string;
  totalDurationMs: number;
  checks: HealthCheckEntry[];
};

export type HealthResult = {
  report: HealthReport;
  /** Browser-measured round trip through the Next.js proxy to the API. */
  latencyMs: number;
};

/** Thrown when no health report came back from the API at all. */
export class ApiUnreachableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiUnreachableError";
  }
}

const HEALTH_STATUSES: readonly string[] = ["Healthy", "Degraded", "Unhealthy"];

function isHealthReport(value: unknown): value is HealthReport {
  if (typeof value !== "object" || value === null) return false;
  const report = value as Record<string, unknown>;
  return (
    typeof report.status === "string" &&
    HEALTH_STATUSES.includes(report.status) &&
    typeof report.timestamp === "string" &&
    Array.isArray(report.checks)
  );
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResult> {
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch("/api/v1/health", {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiUnreachableError("The network request to the API failed.", { cause: error });
  }

  const latencyMs = performance.now() - startedAt;

  // 200 = healthy or degraded, 503 = API is up but a dependency is failing.
  // Anything else (e.g. the dev proxy's 500 when the API isn't running) is not a health report.
  if (response.status !== 200 && response.status !== 503) {
    throw new ApiUnreachableError(`The API did not respond (HTTP ${response.status}).`);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isHealthReport(body)) {
    throw new ApiUnreachableError("The API returned an unexpected response.");
  }

  return { report: body, latencyMs };
}

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: ({ signal }) => fetchHealth(signal),
  refetchInterval: 15_000,
  retry: false,
});
