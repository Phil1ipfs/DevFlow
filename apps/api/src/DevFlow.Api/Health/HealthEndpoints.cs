using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DevFlow.Api.Health;

public static class HealthEndpoints
{
    /// <summary>Readiness: the API and its dependencies (database). 503 when any check fails.</summary>
    public const string Route = "/api/v1/health";

    /// <summary>
    /// Liveness: the process is up and serving requests; no dependency checks. Container
    /// orchestrators restart the API only when this fails, so a database outage does not trigger
    /// a pointless restart loop.
    /// </summary>
    public const string LiveRoute = "/api/v1/health/live";

    /// <summary>
    /// Maps the health endpoints. Readiness returns 200 when every check is Healthy or Degraded,
    /// and 503 when any check is Unhealthy; the JSON body is written in both cases.
    /// </summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapHealthChecks(Route, new HealthCheckOptions { ResponseWriter = WriteResponseAsync });
        app.MapHealthChecks(LiveRoute, new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteResponseAsync });
        return app;
    }

    private static Task WriteResponseAsync(HttpContext context, HealthReport report)
    {
        var response = new HealthResponse(
            Status: report.Status.ToString(),
            Timestamp: DateTimeOffset.UtcNow,
            TotalDurationMs: report.TotalDuration.TotalMilliseconds,
            Checks: report.Entries
                .Select(entry => new HealthCheckEntry(
                    Name: entry.Key,
                    Status: entry.Value.Status.ToString(),
                    Description: entry.Value.Description,
                    DurationMs: entry.Value.Duration.TotalMilliseconds))
                .ToList());

        // Health data must always be live, never served from a browser or proxy cache.
        context.Response.Headers.CacheControl = "no-store";
        return context.Response.WriteAsJsonAsync(response);
    }
}
