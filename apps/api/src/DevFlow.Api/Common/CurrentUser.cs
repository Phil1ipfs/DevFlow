using System.Security.Claims;
using DevFlow.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace DevFlow.Api.Common;

/// <summary>Reads the signed-in user from the auth cookie's claims principal.</summary>
internal sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid Id =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new InvalidOperationException("The current request is not authenticated.");

    // Already the real client address: UseForwardedHeaders applies X-Forwarded-For from the proxy.
    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}

internal sealed class AppUrls(IOptions<AppOptions> options) : IAppUrls
{
    public string Web(string relativePath) => $"{options.Value.WebBaseUrl.TrimEnd('/')}/{relativePath.TrimStart('/')}";
}
