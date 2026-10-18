using System.Net;
using DevFlow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Npgsql;

namespace DevFlow.Api.Tests.Infrastructure;

/// <summary>
/// Boots the real API in memory against a fresh, uniquely named PostgreSQL database that is
/// migrated on start and dropped on dispose. Tests therefore exercise real SQL, constraints and
/// migrations, not an in-memory imitation.
/// </summary>
/// <remarks>
/// The server connection comes from ConnectionStrings:DevFlowTest (user-secrets locally, an
/// environment variable in CI). Its role needs the CREATEDB privilege.
/// </remarks>
public sealed class DevFlowApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databaseName = $"devflow_test_{Guid.NewGuid():N}";
    private readonly string _serverConnectionString;

    public DevFlowApiFactory()
    {
        var configuration = new ConfigurationBuilder()
            .AddUserSecrets<DevFlowApiFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        _serverConnectionString = configuration.GetConnectionString("DevFlowTest")
            ?? throw new InvalidOperationException(
                "Set ConnectionStrings:DevFlowTest (user-secrets for tests/DevFlow.Api.Tests, or the " +
                "ConnectionStrings__DevFlowTest environment variable) to a PostgreSQL server the tests may create databases on.");

        DatabaseConnectionString = new NpgsqlConnectionStringBuilder(_serverConnectionString)
        {
            Database = _databaseName,
        }.ConnectionString;
    }

    public string DatabaseConnectionString { get; }

    /// <summary>
    /// The API's clock. Starts at the real time and ticks 1 ms per read so ordering by timestamp
    /// stays meaningful; tests call Advance to make time pass (e.g. for background jobs).
    /// </summary>
    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow) { AutoAdvanceAmount = TimeSpan.FromMilliseconds(1) };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DevFlow", DatabaseConnectionString);
        // Tests trigger jobs explicitly with RunOnceAsync instead of waiting for timers.
        builder.UseSetting("BackgroundJobs:Enabled", "false");
        builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Clock));
    }

    public async ValueTask InitializeAsync()
    {
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();
        await db.Database.MigrateAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();

        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"""DROP DATABASE IF EXISTS "{_databaseName}" WITH (FORCE)""", connection);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>A client that keeps cookies and sends CSRF tokens, like the browser does.</summary>
    public TestApiClient CreateApiClient() => new(CreateClient(new WebApplicationFactoryClientOptions
    {
        HandleCookies = true,
        AllowAutoRedirect = false,
    }));

    /// <summary>
    /// A client whose cookies are visible to the test, so other connections (e.g. SignalR)
    /// can reuse the same signed-in session.
    /// </summary>
    public (TestApiClient Client, CookieContainer Cookies) CreateApiClientWithCookies()
    {
        var cookies = new CookieContainer();
        var http = new HttpClient(new CookieContainerHandler(cookies) { InnerHandler = Server.CreateHandler() })
        {
            BaseAddress = Server.BaseAddress,
        };
        return (new TestApiClient(http), cookies);
    }

    public HttpMessageHandler CreateCookieHandler(CookieContainer cookies) =>
        new CookieContainerHandler(cookies) { InnerHandler = Server.CreateHandler() };

    public T Job<T>() where T : notnull => Services.GetRequiredService<T>();
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<DevFlowApiFactory>
{
    public const string Name = "API with database";
}
