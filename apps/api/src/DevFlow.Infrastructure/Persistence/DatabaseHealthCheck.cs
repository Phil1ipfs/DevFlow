using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Persistence;

/// <summary>
/// Reports whether the API can open a connection to PostgreSQL.
/// </summary>
internal sealed class DatabaseHealthCheck(DevFlowDbContext dbContext, ILogger<DatabaseHealthCheck> logger)
    : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (await dbContext.Database.CanConnectAsync(cancellationToken))
            {
                return HealthCheckResult.Healthy("Database connection succeeded.");
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The exception text can contain host names, so it goes to the server log only,
            // never into the public health response.
            logger.LogWarning(ex, "Database health check failed.");
        }

        return new HealthCheckResult(context.Registration.FailureStatus, "Database connection failed.");
    }
}
