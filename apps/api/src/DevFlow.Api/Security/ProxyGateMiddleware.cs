using System.Net;
using System.Security.Cryptography;
using System.Text;
using DevFlow.Api.Health;

namespace DevFlow.Api.Security;

/// <summary>
/// Lets the API sit behind a proxy whose addresses are not known in advance (e.g. Vercel).
/// </summary>
/// <remarks>
/// Enabled by setting Proxy:SharedSecret. The web app's proxy (apps/web/src/proxy.ts) then adds
/// two headers to every request it forwards:
/// <list type="bullet">
/// <item><see cref="SecretHeader"/>: proves the request came through the web app. Anything
/// without it gets a 404, so the API cannot be called directly to skip the web app's checks.</item>
/// <item><see cref="ClientIpHeader"/>: the visitor's IP as the hosting platform reported it.
/// Trusted only because the secret matched; used for rate limiting and audit logs.</item>
/// </list>
/// Health endpoints stay open so the container platform's probes keep working.
/// This replaces IP-based trust (Proxy:TrustedNetworks), which needs fixed proxy addresses.
/// </remarks>
internal sealed class ProxyGateMiddleware(RequestDelegate next, string sharedSecret)
{
    public const string SecretHeader = "X-DevFlow-Proxy-Secret";
    public const string ClientIpHeader = "X-DevFlow-Client-IP";

    private readonly byte[] _secret = Encoding.UTF8.GetBytes(sharedSecret);

    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Request.Headers;

        if (!context.Request.Path.StartsWithSegments(HealthEndpoints.Route))
        {
            // Constant-time comparison: response timing reveals nothing about the secret.
            var presented = Encoding.UTF8.GetBytes(headers[SecretHeader].ToString());
            if (!CryptographicOperations.FixedTimeEquals(presented, _secret))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return Task.CompletedTask;
            }

            if (IPAddress.TryParse(headers[ClientIpHeader].ToString(), out var clientIp))
            {
                context.Connection.RemoteIpAddress = clientIp;
            }
        }

        // Nothing further down the pipeline (or in logs) needs to see these.
        headers.Remove(SecretHeader);
        headers.Remove(ClientIpHeader);
        return next(context);
    }
}
