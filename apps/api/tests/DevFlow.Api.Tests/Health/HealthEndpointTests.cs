using System.Net;
using System.Net.Http.Json;
using DevFlow.Api.Health;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DevFlow.Api.Tests.Health;

public sealed class HealthEndpointTests(HealthEndpointTests.UnreachableDatabaseFactory factory)
    : IClassFixture<HealthEndpointTests.UnreachableDatabaseFactory>
{
    [Fact]
    public async Task Returns_503_and_reports_database_unhealthy_when_database_is_unreachable()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(HealthEndpoints.Route, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());

        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        Assert.NotNull(body);
        Assert.Equal("Unhealthy", body.Status);
        var database = Assert.Single(body.Checks, check => check.Name == "database");
        Assert.Equal("Unhealthy", database.Status);
        Assert.Equal("Database connection failed.", database.Description);
    }

    [Fact]
    public async Task Liveness_stays_healthy_when_the_database_is_down()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(HealthEndpoints.LiveRoute, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        Assert.Equal("Healthy", body!.Status);
        Assert.Empty(body.Checks);
    }

    [Fact]
    public async Task Responses_carry_security_headers()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(HealthEndpoints.LiveRoute, TestContext.Current.CancellationToken);

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("default-src 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Fact]
    public async Task Returns_200_and_healthy_status_when_all_checks_pass()
    {
        using var client = factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                services.Configure<HealthCheckServiceOptions>(options =>
                {
                    options.Registrations.Clear();
                    options.Registrations.Add(new HealthCheckRegistration(
                        "database",
                        _ => new StubHealthCheck(HealthCheckResult.Healthy("ok")),
                        failureStatus: null,
                        tags: null));
                })))
            .CreateClient();

        using var response = await client.GetAsync(HealthEndpoints.Route, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        Assert.NotNull(body);
        Assert.Equal("Healthy", body.Status);
        Assert.Equal("Healthy", Assert.Single(body.Checks).Status);
    }

    /// <summary>
    /// Boots the real API in memory, pointed at a port where nothing listens,
    /// so the database check fails fast without needing PostgreSQL installed.
    /// </summary>
    public sealed class UnreachableDatabaseFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting(
                "ConnectionStrings:DevFlow",
                "Host=127.0.0.1;Port=1;Database=devflow_test;Username=test;Password=test;Timeout=3");
        }
    }

    private sealed class StubHealthCheck(HealthCheckResult result) : IHealthCheck
    {
        public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
            => Task.FromResult(result);
    }
}
