using DevFlow.Domain.Common;

namespace DevFlow.Domain.Notifications;

/// <summary>An in-app notification for one user, e.g. "Ana assigned you WEB-12".</summary>
public sealed class Notification : Entity
{
    public Guid OrganizationId { get; init; }

    public Guid RecipientId { get; init; }

    public Guid? ActorId { get; init; }

    /// <summary>e.g. "task.assigned", "task.commented", "ticket.status_changed".</summary>
    public required string Type { get; init; }

    public required string Title { get; init; }

    public string? Body { get; init; }

    /// <summary>Relative link in the web app, e.g. "/app/projects/{id}?task={id}".</summary>
    public required string Link { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? ReadAt { get; private set; }

    public void MarkRead(DateTimeOffset now) => ReadAt ??= now;
}
