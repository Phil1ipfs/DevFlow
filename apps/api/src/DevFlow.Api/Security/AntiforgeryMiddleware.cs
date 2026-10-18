using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Security;

/// <summary>
/// CSRF protection for the cookie-authenticated JSON API.
/// </summary>
/// <remarks>
/// Every state-changing request (POST, PUT, PATCH, DELETE) under /api must carry the
/// X-CSRF-TOKEN header obtained from GET /api/v1/auth/csrf. A malicious site can make the
/// browser send DevFlow's cookies, but it cannot read the token, so its forged requests fail.
/// This sits on top of SameSite=Lax cookies as a second, independent layer.
/// </remarks>
internal sealed class AntiforgeryMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-CSRF-TOKEN";

    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery, IProblemDetailsService problemDetails)
    {
        var method = context.Request.Method;
        var unsafeMethod = HttpMethods.IsPost(method) || HttpMethods.IsPut(method)
            || HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);

        if (unsafeMethod && context.Request.Path.StartsWithSegments("/api"))
        {
            try
            {
                await antiforgery.ValidateRequestAsync(context);
            }
            catch (AntiforgeryValidationException)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await problemDetails.WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context,
                    ProblemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status400BadRequest,
                        Title = "Invalid or missing CSRF token.",
                        Extensions = { ["code"] = "csrf_invalid" },
                    },
                });
                return;
            }
        }

        await next(context);
    }
}
