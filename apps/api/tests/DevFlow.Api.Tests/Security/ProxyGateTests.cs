using System.Net;
using DevFlow.Api.Health;
using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Audit;
using DevFlow.Application.Features.Organizations;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DevFlow.Api.Tests.Security;

[Collection(ApiCollection.Name)]
public sealed class ProxyGateTests(DevFlowApiFactory factory)
{
    private const string Secret = "test-proxy-secret-0123456789abcdefghij";

    // The shared API host, with the gate switched on. Disposed together with the parent factory.
    private readonly WebApplicationFactory<Program> _gated =
        factory.WithWebHostBuilder(builder => builder.UseSetting("Proxy:SharedSecret", Secret));

    private TestApiClient Client(string? secret = null, string? clientIp = null)
    {
        var http = _gated.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
        if (secret is not null) http.DefaultRequestHeaders.Add("X-DevFlow-Proxy-Secret", secret);
        if (clientIp is not null) http.DefaultRequestHeaders.Add("X-DevFlow-Client-IP", clientIp);
        return new TestApiClient(http);
    }

    [Fact]
    public async Task Requests_without_the_secret_are_hidden_but_health_stays_open()
    {
        using var anonymous = Client();
        using var wrongSecret = Client(secret: "not-the-secret");

        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await anonymous.GetAsync("/api/v1/auth/csrf"));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await wrongSecret.GetAsync("/api/v1/auth/csrf"));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await anonymous.GetAsync("/hubs/notifications/negotiate"));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await anonymous.GetAsync(HealthEndpoints.LiveRoute));
    }

    [Fact]
    public async Task Requests_with_the_secret_work_and_record_the_forwarded_client_ip()
    {
        using var client = Client(Secret, "203.0.113.7");
        await client.RegisterAsync(displayName: "Proxied");

        var organization = await client.PostJsonAsync<OrganizationResponse>("/api/v1/organizations", new CreateOrganizationRequest("Proxied Co"));
        var audit = await client.GetJsonAsync<PagedResult<AuditLogResponse>>($"/api/v1/organizations/{organization.Id}/audit-logs");

        var created = Assert.Single(audit.Items);
        Assert.Equal("203.0.113.7", created.IpAddress);
    }
}
