using DevFlow.Application.Abstractions;
using DevFlow.Infrastructure.BackgroundJobs;
using DevFlow.Infrastructure.Email;
using DevFlow.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;

namespace DevFlow.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "DevFlow";

    /// <summary>
    /// Registers database access, email delivery and infrastructure health checks.
    /// </summary>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string 'ConnectionStrings:{ConnectionStringName}' is not configured. " +
                "For local development set it with: " +
                $"dotnet user-secrets set \"ConnectionStrings:{ConnectionStringName}\" \"<connection string>\" --project src/DevFlow.Api");
        }

        services.AddDbContext<DevFlowDbContext>(options => options
            .UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(DevFlowDbContext).Assembly.FullName))
            .UseSnakeCaseNamingConvention());

        // Application services depend on the interface; this maps it to the same scoped instance.
        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<DevFlowDbContext>());
        services.AddScoped<ISequenceAllocator, SequenceAllocator>();

        services.AddDataProtection()
            .SetApplicationName("DevFlow")
            .PersistKeysToDbContext<DevFlowDbContext>();

        services.AddSingleton(TimeProvider.System);

        // In-memory cache for report aggregates. When the API runs on several instances, add a
        // distributed second level (e.g. Redis via AddStackExchangeRedisCache) and HybridCache
        // uses it automatically; until then a separate cache server is not justified.
        services.AddHybridCache();

        AddBackgroundJobs(services, configuration);

        AddEmail(services, configuration, environment);

        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>(
                "database",
                failureStatus: HealthStatus.Unhealthy,
                tags: ["ready"],
                timeout: TimeSpan.FromSeconds(5));

        return services;
    }

    private static void AddBackgroundJobs(IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BackgroundJobOptions>(configuration.GetSection(BackgroundJobOptions.SectionName));
        // Registered as singletons first so the same instance can be resolved (e.g. by tests
        // calling RunOnceAsync) and also run by the host.
        services.AddSingleton<DueDateReminderJob>();
        services.AddSingleton<TicketEscalationJob>();
        services.AddSingleton<DataRetentionJob>();
        services.AddHostedService(provider => provider.GetRequiredService<DueDateReminderJob>());
        services.AddHostedService(provider => provider.GetRequiredService<TicketEscalationJob>());
        services.AddHostedService(provider => provider.GetRequiredService<DataRetentionJob>());
    }

    private static void AddEmail(IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var section = configuration.GetSection(EmailOptions.SectionName);
        services.Configure<EmailOptions>(section);
        services.AddSingleton<DevMailbox>();

        if (!string.IsNullOrWhiteSpace(section[nameof(EmailOptions.SmtpHost)]))
        {
            services.AddScoped<IEmailSender, SmtpEmailSender>();
        }
        else if (environment.IsProduction())
        {
            services.AddScoped<IEmailSender, UnconfiguredEmailSender>();
        }
        else
        {
            services.AddScoped<IEmailSender, DevMailboxEmailSender>();
        }
    }
}
