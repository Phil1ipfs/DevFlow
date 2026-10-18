using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using DevFlow.Application.Features.Auth;

namespace DevFlow.Api.Tests.Infrastructure;

/// <summary>
/// Thin wrapper over HttpClient that behaves like the web app: cookies persist between calls,
/// and every state-changing request fetches and sends a CSRF token first.
/// </summary>
public sealed class TestApiClient(HttpClient http) : IDisposable
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public HttpClient Http { get; } = http;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public Task<HttpResponseMessage> GetAsync(string path) => Http.GetAsync(path, Ct);

    public async Task<T> GetJsonAsync<T>(string path)
    {
        using var response = await Http.GetAsync(path, Ct);
        await EnsureSuccessAsync(response);
        return (await response.Content.ReadFromJsonAsync<T>(Json, Ct))!;
    }

    public Task<HttpResponseMessage> PostAsync(string path, object? body = null) => SendAsync(HttpMethod.Post, path, body);

    public Task<HttpResponseMessage> PatchAsync(string path, object? body = null) => SendAsync(HttpMethod.Patch, path, body);

    public Task<HttpResponseMessage> PutAsync(string path, object? body = null) => SendAsync(HttpMethod.Put, path, body);

    public Task<HttpResponseMessage> DeleteAsync(string path) => SendAsync(HttpMethod.Delete, path, null);

    public async Task<T> PostJsonAsync<T>(string path, object? body = null)
    {
        using var response = await PostAsync(path, body);
        await EnsureSuccessAsync(response);
        return (await response.Content.ReadFromJsonAsync<T>(Json, Ct))!;
    }

    public async Task<T> PatchJsonAsync<T>(string path, object? body = null)
    {
        using var response = await PatchAsync(path, body);
        await EnsureSuccessAsync(response);
        return (await response.Content.ReadFromJsonAsync<T>(Json, Ct))!;
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, bool includeCsrf = true)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: Json);
        }

        if (includeCsrf)
        {
            var csrf = await Http.GetFromJsonAsync<CsrfTokenResponse>("/api/v1/auth/csrf", Json, Ct);
            request.Headers.Add("X-CSRF-TOKEN", csrf!.Token);
        }

        return await Http.SendAsync(request, Ct);
    }

    /// <summary>Registers a new, unique user and leaves this client signed in as them.</summary>
    public async Task<CurrentUserResponse> RegisterAsync(string? email = null, string password = TestData.Password, string? displayName = null)
    {
        email ??= TestData.UniqueEmail();
        return await PostJsonAsync<CurrentUserResponse>("/api/v1/auth/register",
            new RegisterRequest(email, password, displayName ?? email.Split('@')[0]));
    }

    public async Task LoginAsync(string email, string password = TestData.Password)
    {
        using var response = await PostAsync("/api/v1/auth/login", new LoginRequest(email, password, false));
        await EnsureSuccessAsync(response);
    }

    public static async Task EnsureSuccessAsync(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(Ct);
            throw new HttpRequestException($"{(int)response.StatusCode} {response.StatusCode}: {body}", null, response.StatusCode);
        }
    }

    public void Dispose() => Http.Dispose();
}

public static class TestData
{
    public const string Password = "correct-horse-battery";

    public static string UniqueEmail(string prefix = "user") => $"{prefix}-{Guid.NewGuid():N}@example.test";
}

public static class HttpAssert
{
    public static async Task StatusAsync(HttpStatusCode expected, HttpResponseMessage response)
    {
        if (response.StatusCode != expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.Fail($"Expected {(int)expected} {expected} but got {(int)response.StatusCode} {response.StatusCode}: {body}");
        }
    }
}
