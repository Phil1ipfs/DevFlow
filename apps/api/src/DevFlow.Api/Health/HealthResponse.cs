namespace DevFlow.Api.Health;

/// <summary>JSON body returned by <c>GET /api/v1/health</c>.</summary>
public sealed record HealthResponse(
    string Status,
    DateTimeOffset Timestamp,
    double TotalDurationMs,
    IReadOnlyList<HealthCheckEntry> Checks);

public sealed record HealthCheckEntry(
    string Name,
    string Status,
    string? Description,
    double DurationMs);
