namespace DevFlow.Api.Security;

/// <summary>
/// Defensive headers for every API response. The API only returns JSON, so it can use the
/// strictest policy: nothing may be loaded, framed or sniffed from its responses.
/// </summary>
internal sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Cross-Origin-Resource-Policy"] = "same-site";
            // The OpenAPI document (development only) is plain JSON too, so this does not break it.
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
            headers.Remove("Server");
            return Task.CompletedTask;
        });
        return next(context);
    }
}
