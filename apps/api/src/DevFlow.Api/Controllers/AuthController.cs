using System.Text;
using DevFlow.Api.Security;
using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Auth;
using DevFlow.Domain.Users;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;

namespace DevFlow.Api.Controllers;

/// <summary>
/// Registration, sign-in and password management.
/// </summary>
/// <remarks>
/// A controller is the HTTP edge of the app: it maps routes to C# methods, binds JSON bodies to
/// DTOs and turns results into status codes. Authentication is inherently an HTTP concern
/// (it sets cookies), so this controller talks to Identity's UserManager/SignInManager directly.
/// </remarks>
[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    UserManager<User> userManager,
    SignInManager<User> signInManager,
    IAntiforgery antiforgery,
    IEmailSender emailSender,
    ICurrentUser currentUser,
    TimeProvider clock,
    IAppUrls urls,
    AuditTrail audit,
    IAppDbContext db,
    ILogger<AuthController> logger) : ControllerBase
{
    /// <summary>Issues a CSRF token for the current session (anonymous or signed in).</summary>
    [HttpGet("csrf")]
    [AllowAnonymous]
    public ActionResult<CsrfTokenResponse> GetCsrfToken()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Headers.CacheControl = "no-store";
        return new CsrfTokenResponse(tokens.RequestToken!);
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(SecurityServiceCollectionExtensions.AuthRateLimitPolicy)]
    public async Task<ActionResult<CurrentUserResponse>> Register(RegisterRequest request)
    {
        var email = NormalizeEmail(request.Email);
        if (await userManager.FindByEmailAsync(email) is not null)
        {
            throw new ConflictException("An account with this email address already exists.");
        }

        var user = new User(email, request.DisplayName.Trim()) { CreatedAt = clock.GetUtcNow() };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            throw ToValidationException(result, "password");
        }

        await signInManager.SignInAsync(user, isPersistent: true);
        await RecordAsync("auth.registered", user, "Created an account");
        logger.LogInformation("User {UserId} registered", user.Id);
        return ToResponse(user);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(SecurityServiceCollectionExtensions.AuthRateLimitPolicy)]
    public async Task<ActionResult<CurrentUserResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(NormalizeEmail(request.Email));
        if (user is null)
        {
            // Same response as a wrong password, so attackers cannot discover which emails exist.
            return InvalidCredentials();
        }

        var result = await signInManager.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            await RecordAsync("auth.locked_out", user, "Sign-in blocked: account temporarily locked");
            logger.LogWarning("Sign-in blocked for locked-out user {UserId}", user.Id);
            return Problem(
                statusCode: StatusCodes.Status423Locked,
                title: "Too many failed attempts. Try again in 15 minutes or reset your password.");
        }

        if (!result.Succeeded)
        {
            await RecordAsync("auth.sign_in_failed", user, "Failed sign-in attempt");
            logger.LogInformation("Failed sign-in for user {UserId}", user.Id);
            return InvalidCredentials();
        }

        await RecordAsync("auth.signed_in", user, "Signed in");
        return ToResponse(user);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> Me()
    {
        var user = await userManager.FindByIdAsync(currentUser.Id.ToString());
        return user is null ? Unauthorized() : ToResponse(user);
    }

    [HttpPatch("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponse>> UpdateProfile(UpdateProfileRequest request)
    {
        var user = await userManager.FindByIdAsync(currentUser.Id.ToString())
            ?? throw new NotFoundException("User");
        user.DisplayName = request.DisplayName.Trim();
        await userManager.UpdateAsync(user);
        return ToResponse(user);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await userManager.FindByIdAsync(currentUser.Id.ToString())
            ?? throw new NotFoundException("User");
        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            throw ToValidationException(result, "currentPassword");
        }

        // The security stamp changed; re-issue this session's cookie so it stays valid.
        await signInManager.RefreshSignInAsync(user);
        await RecordAsync("auth.password_changed", user, "Changed password");
        return NoContent();
    }

    /// <summary>
    /// Emails a reset link if the account exists. Always returns 202 so the response does not
    /// reveal whether an email address is registered.
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(SecurityServiceCollectionExtensions.AuthRateLimitPolicy)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var user = await userManager.FindByEmailAsync(email);
        if (user is not null)
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var link = urls.Web($"/reset-password?email={Uri.EscapeDataString(email)}&token={encodedToken}");

            await emailSender.SendAsync(new EmailMessage(
                email,
                "Reset your DevFlow password",
                $"""
                Hi {user.DisplayName},

                Someone asked to reset the password for your DevFlow account.
                Use this link within one hour to choose a new password:

                {link}

                If you did not ask for this, you can ignore this email; your password stays the same.
                """), cancellationToken);
        }

        return Accepted();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(SecurityServiceCollectionExtensions.AuthRateLimitPolicy)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        const string invalidLink = "This reset link is invalid or has expired. Request a new one.";
        var user = await userManager.FindByEmailAsync(NormalizeEmail(request.Email))
            ?? throw new AppValidationException("token", invalidLink);

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (FormatException)
        {
            throw new AppValidationException("token", invalidLink);
        }

        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            var invalidToken = result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.InvalidToken));
            throw invalidToken
                ? new AppValidationException("token", invalidLink)
                : ToValidationException(result, "newPassword");
        }

        // A successful reset also clears any lockout from earlier failed attempts.
        await userManager.SetLockoutEndDateAsync(user, null);
        await userManager.ResetAccessFailedCountAsync(user);
        await RecordAsync("auth.password_reset", user, "Reset password using an emailed link");
        return NoContent();
    }

    /// <summary>Account-level security events (no organization) for the audit trail.</summary>
    private async Task RecordAsync(string action, User user, string summary)
    {
        audit.Record(null, action, "user", user.Id, summary, actorId: user.Id);
        await db.SaveChangesAsync(HttpContext.RequestAborted);
    }

    private ObjectResult InvalidCredentials() =>
        Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static CurrentUserResponse ToResponse(User user) => new(user.Id, user.Email!, user.DisplayName);

    private static AppValidationException ToValidationException(IdentityResult result, string field) =>
        new(new Dictionary<string, string[]> { [field] = result.Errors.Select(e => e.Description).ToArray() });
}
