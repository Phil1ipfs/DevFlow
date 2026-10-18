using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Features.Auth;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Tests.Auth;

[Collection(ApiCollection.Name)]
public sealed partial class AuthTests(DevFlowApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_signs_in_with_a_secure_http_only_cookie()
    {
        using var client = factory.CreateApiClient();
        var email = TestData.UniqueEmail();

        using var response = await client.PostAsync("/api/v1/auth/register", new RegisterRequest(email, TestData.Password, "Ada"));

        await HttpAssert.StatusAsync(HttpStatusCode.OK, response);
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("devflow.auth="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);

        var me = await client.GetJsonAsync<CurrentUserResponse>("/api/v1/auth/me");
        Assert.Equal(email, me.Email);
        Assert.Equal("Ada", me.DisplayName);
    }

    [Fact]
    public async Task Register_rejects_duplicate_email_case_insensitively()
    {
        using var client = factory.CreateApiClient();
        var email = TestData.UniqueEmail();
        await client.RegisterAsync(email);

        using var other = factory.CreateApiClient();
        using var response = await other.PostAsync("/api/v1/auth/register",
            new RegisterRequest(email.ToUpperInvariant(), TestData.Password, "Copy"));

        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, response);
    }

    [Fact]
    public async Task Register_validates_fields()
    {
        using var client = factory.CreateApiClient();

        using var response = await client.PostAsync("/api/v1/auth/register", new RegisterRequest("not-an-email", "short", ""));

        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, response);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(Ct);
        Assert.Contains("email", problem!.Errors.Keys);
        Assert.Contains("password", problem.Errors.Keys);
        Assert.Contains("displayName", problem.Errors.Keys);
    }

    [Fact]
    public async Task Login_succeeds_with_correct_password_and_fails_generically_otherwise()
    {
        using var setup = factory.CreateApiClient();
        var user = await setup.RegisterAsync();

        using var client = factory.CreateApiClient();
        using var wrong = await client.PostAsync("/api/v1/auth/login", new LoginRequest(user.Email, "wrong-password-123", false));
        using var unknown = await client.PostAsync("/api/v1/auth/login", new LoginRequest(TestData.UniqueEmail(), "whatever-123", false));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, wrong);
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, unknown);
        Assert.Equal(
            (await wrong.Content.ReadFromJsonAsync<ProblemDetails>(Ct))!.Title,
            (await unknown.Content.ReadFromJsonAsync<ProblemDetails>(Ct))!.Title);

        await client.LoginAsync(user.Email);
        var me = await client.GetJsonAsync<CurrentUserResponse>("/api/v1/auth/me");
        Assert.Equal(user.Id, me.Id);
    }

    [Fact]
    public async Task Account_locks_after_five_failed_attempts()
    {
        using var client = factory.CreateApiClient();
        var user = await client.RegisterAsync();
        await client.PostAsync("/api/v1/auth/logout");

        for (var i = 0; i < 5; i++)
        {
            using var failed = await client.PostAsync("/api/v1/auth/login", new LoginRequest(user.Email, "wrong-password-123", false));
        }

        using var response = await client.PostAsync("/api/v1/auth/login", new LoginRequest(user.Email, TestData.Password, false));
        await HttpAssert.StatusAsync(HttpStatusCode.Locked, response);
    }

    [Fact]
    public async Task State_changing_requests_without_csrf_token_are_rejected()
    {
        using var client = factory.CreateApiClient();

        using var response = await client.SendAsync(HttpMethod.Post, "/api/v1/auth/register",
            new RegisterRequest(TestData.UniqueEmail(), TestData.Password, "NoToken"), includeCsrf: false);

        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, response);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(Ct);
        Assert.Equal("csrf_invalid", problem!.Extensions["code"]?.ToString());
    }

    [Fact]
    public async Task Me_requires_authentication_and_logout_ends_the_session()
    {
        using var client = factory.CreateApiClient();
        using var anonymous = await client.GetAsync("/api/v1/auth/me");
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, anonymous);

        await client.RegisterAsync();
        using var logout = await client.PostAsync("/api/v1/auth/logout");
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, logout);

        using var after = await client.GetAsync("/api/v1/auth/me");
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, after);
    }

    [Fact]
    public async Task Forgot_password_emails_a_link_that_resets_the_password_once()
    {
        using var client = factory.CreateApiClient();
        var user = await client.RegisterAsync();
        await client.PostAsync("/api/v1/auth/logout");

        using var forgot = await client.PostAsync("/api/v1/auth/forgot-password", new ForgotPasswordRequest(user.Email));
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, forgot);

        var token = await ReadResetTokenAsync(client, user.Email);
        const string newPassword = "a-brand-new-passphrase";
        using var reset = await client.PostAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(user.Email, token, newPassword));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, reset);

        using var oldLogin = await client.PostAsync("/api/v1/auth/login", new LoginRequest(user.Email, TestData.Password, false));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, oldLogin);
        await client.LoginAsync(user.Email, newPassword);

        using var reuse = await client.PostAsync("/api/v1/auth/reset-password", new ResetPasswordRequest(user.Email, token, "yet-another-passphrase"));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, reuse);
    }

    [Fact]
    public async Task Forgot_password_does_not_reveal_unknown_emails()
    {
        using var client = factory.CreateApiClient();
        var email = TestData.UniqueEmail();

        using var response = await client.PostAsync("/api/v1/auth/forgot-password", new ForgotPasswordRequest(email));

        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, response);
        var emails = await client.GetJsonAsync<List<CapturedEmailDto>>($"/api/v1/dev/emails?to={Uri.EscapeDataString(email)}");
        Assert.Empty(emails);
    }

    [Fact]
    public async Task Change_password_keeps_the_current_session_signed_in()
    {
        using var client = factory.CreateApiClient();
        var user = await client.RegisterAsync();

        using var change = await client.PostAsync("/api/v1/auth/change-password",
            new ChangePasswordRequest(TestData.Password, "another-long-passphrase"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, change);

        var me = await client.GetJsonAsync<CurrentUserResponse>("/api/v1/auth/me");
        Assert.Equal(user.Id, me.Id);
    }

    private static async Task<string> ReadResetTokenAsync(TestApiClient client, string email)
    {
        var emails = await client.GetJsonAsync<List<CapturedEmailDto>>($"/api/v1/dev/emails?to={Uri.EscapeDataString(email)}");
        var body = Assert.Single(emails).TextBody;
        return ResetTokenPattern().Match(body).Groups[1].Value;
    }

    [GeneratedRegex(@"token=([A-Za-z0-9_\-]+)")]
    private static partial Regex ResetTokenPattern();

    private sealed record CapturedEmailDto(string To, string Subject, string TextBody);
}
