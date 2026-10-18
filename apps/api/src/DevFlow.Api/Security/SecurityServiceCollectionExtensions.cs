using System.Threading.RateLimiting;
using DevFlow.Application.Features.Auth;
using DevFlow.Domain.Users;
using DevFlow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;

namespace DevFlow.Api.Security;

public static class SecurityServiceCollectionExtensions
{
    public const string AuthCookieName = "devflow.auth";
    public const string AuthRateLimitPolicy = "auth";

    public static IServiceCollection AddDevFlowSecurity(this IServiceCollection services, IHostEnvironment environment, IConfiguration configuration)
    {
        // Sign-in, sign-up and reset attempts per client IP per minute. 10 in production;
        // appsettings.Development.json raises it so local test runs are not throttled.
        var authAttemptsPerMinute = configuration.GetValue("Security:AuthAttemptsPerMinute", 10);

        // ---- Identity: users, password hashing, lockout, reset tokens ----
        services
            .AddIdentityCore<User>(options =>
            {
                options.User.RequireUniqueEmail = true;

                options.Password.RequiredLength = PasswordRules.MinLength;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddEntityFrameworkStores<DevFlowDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        // Password-reset links stay valid for one hour.
        services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromHours(1));

        // A password reset or change updates the user's security stamp; other sessions holding an
        // old cookie are rejected at the next validation, at most five minutes later.
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.FromMinutes(5));

        // ---- Cookie authentication ----
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = AuthCookieName;
            options.Cookie.HttpOnly = true; // JavaScript can never read the session cookie.
            options.Cookie.SameSite = SameSiteMode.Lax;
            // Secure (HTTPS only) in Production; plain http://localhost works in development.
            options.Cookie.SecurePolicy = environment.IsProduction()
                ? CookieSecurePolicy.Always
                : CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;

            // This is an API: answer 401/403 instead of redirecting to an HTML login page.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorization();

        // ---- CSRF tokens (validated by AntiforgeryMiddleware) ----
        services.AddAntiforgery(options =>
        {
            options.HeaderName = AntiforgeryMiddleware.HeaderName;
            options.Cookie.Name = "devflow.csrf";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = environment.IsProduction()
                ? CookieSecurePolicy.Always
                : CookieSecurePolicy.SameAsRequest;
        });

        // ---- Rate limiting: slows down password guessing and email flooding ----
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimitPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = environment.IsEnvironment("Testing") ? 1000 : authAttemptsPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                    }));
        });

        return services;
    }
}
