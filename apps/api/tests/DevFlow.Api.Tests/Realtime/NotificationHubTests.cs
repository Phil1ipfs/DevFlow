using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Features.Auth;
using DevFlow.Application.Features.Notifications;
using DevFlow.Application.Features.Tasks;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

namespace DevFlow.Api.Tests.Realtime;

[Collection(ApiCollection.Name)]
public sealed class NotificationHubTests(DevFlowApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Assignment_is_pushed_to_the_assignee_over_signalr()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        var organization = await Scenario.OrganizationAsync(owner);
        var project = await Scenario.ProjectAsync(owner, organization.Id);

        // Bob signs in with a cookie jar we can share with the SignalR connection.
        var (bobClient, cookies) = factory.CreateApiClientWithCookies();
        using var _ = bobClient;
        var bobEmail = TestData.UniqueEmail("bob");
        var bob = await bobClient.PostJsonAsync<CurrentUserResponse>("/api/v1/auth/register", new RegisterRequest(bobEmail, TestData.Password, "Bob"));
        await Scenario.JoinAsync(owner, organization.Id, new Scenario.Actor(bobClient, bob));

        await using var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, "/hubs/notifications"), options =>
            {
                // The in-memory test server has no real sockets, so use long polling over its handler.
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.CreateCookieHandler(cookies);
            })
            .Build();
        var received = new TaskCompletionSource<NotificationResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<NotificationResponse>("notification", n => received.TrySetResult(n));
        await connection.StartAsync(Ct);

        await owner.Client.PostJsonAsync<TaskDetail>($"/api/v1/projects/{project.Id}/tasks",
            new CreateTaskRequest("Review the PR", null, null, null, bob.Id, null));

        var notification = await received.Task.WaitAsync(TimeSpan.FromSeconds(10), Ct);
        Assert.Equal("task.assigned", notification.Type);
        Assert.Contains("WEB-1", notification.Title);
        Assert.Equal(owner.User.Id, notification.Actor!.Id);
    }

    [Fact]
    public async Task Hub_rejects_anonymous_connections()
    {
        await using var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(factory.Server.BaseAddress, "/hubs/notifications"), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
            })
            .Build();

        var error = await Assert.ThrowsAsync<HttpRequestException>(() => connection.StartAsync(Ct));
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, error.StatusCode);
    }
}
