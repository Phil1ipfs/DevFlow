using System.IO.Hashing;
using System.Text;
using DevFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.BackgroundJobs;

/// <summary>Bound from "BackgroundJobs". Tests disable the timers and call RunOnceAsync directly.</summary>
public sealed class BackgroundJobOptions
{
    public const string SectionName = "BackgroundJobs";

    public bool Enabled { get; set; } = true;
}

/// <summary>
/// Base for simple in-process recurring jobs. Each run gets its own DI scope (and so its own
/// DbContext), and a failing run is logged without stopping later runs.
/// </summary>
/// <remarks>
/// When several API instances run, each one ticks these jobs; a PostgreSQL advisory lock per job
/// makes sure only one instance executes a given job at a time (the others skip that round), so
/// reminders and escalations are never sent twice. A dedicated scheduler such as Hangfire or
/// Quartz becomes worthwhile once jobs need retries, history or a dashboard.
/// </remarks>
public abstract class RecurringJob(IServiceScopeFactory scopes, IOptions<BackgroundJobOptions> options, ILogger logger)
    : BackgroundService
{
    protected abstract TimeSpan Interval { get; }

    /// <summary>Stable 64-bit lock id derived from the job's type name.</summary>
    private long LockKey => (long)XxHash64.HashToUInt64(Encoding.UTF8.GetBytes(GetType().FullName!));

    /// <summary>One pass of the job, if no other instance is running it. Public so tests can run it on demand.</summary>
    public async Task RunOnceAsync(CancellationToken cancellationToken = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        // Keep one connection open for the whole run: advisory locks belong to the session.
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var acquired = (await db.Database
                .SqlQuery<bool>($"""SELECT pg_try_advisory_lock({LockKey}) AS "Value" """)
                .ToListAsync(cancellationToken)).Single();
            if (!acquired)
            {
                logger.LogDebug("Skipping {Job}: another instance is running it", GetType().Name);
                return;
            }

            try
            {
                await ExecuteOnceAsync(scope.ServiceProvider, cancellationToken);
            }
            finally
            {
                await db.Database.SqlQuery<bool>($"""SELECT pg_advisory_unlock({LockKey}) AS "Value" """).ToListAsync(CancellationToken.None);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    protected abstract Task ExecuteOnceAsync(IServiceProvider services, CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;

        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Background job {Job} failed", GetType().Name);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
