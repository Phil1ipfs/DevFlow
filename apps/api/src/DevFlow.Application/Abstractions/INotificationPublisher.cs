using DevFlow.Application.Features.Notifications;

namespace DevFlow.Application.Abstractions;

/// <summary>
/// Pushes notifications to connected clients in real time. Implemented with SignalR in the API
/// layer; the application layer only knows "deliver this to that user".
/// </summary>
public interface INotificationPublisher
{
    Task PublishAsync(Guid userId, NotificationResponse notification, CancellationToken cancellationToken = default);
}
