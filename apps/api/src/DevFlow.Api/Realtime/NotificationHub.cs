using DevFlow.Application.Abstractions;
using DevFlow.Application.Features.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.Realtime;

/// <summary>
/// Real-time channel for notifications. Clients only listen; the server pushes. SignalR picks
/// the best transport available (WebSockets, then Server-Sent Events, then long polling) and
/// authenticates with the same session cookie as the REST API.
/// </summary>
[Authorize]
public sealed class NotificationHub : Hub
{
    public const string Path = "/hubs/notifications";
    public const string NotificationMethod = "notification";
}

/// <summary>
/// Delivers to every open connection of one user. SignalR maps users by the NameIdentifier
/// claim, which Identity sets to the user id.
/// </summary>
internal sealed class SignalRNotificationPublisher(IHubContext<NotificationHub> hub) : INotificationPublisher
{
    public Task PublishAsync(Guid userId, NotificationResponse notification, CancellationToken cancellationToken = default) =>
        hub.Clients.User(userId.ToString()).SendAsync(NotificationHub.NotificationMethod, notification, cancellationToken);
}
