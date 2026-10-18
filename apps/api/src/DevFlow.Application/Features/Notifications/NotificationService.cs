using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Notifications;
using DevFlow.Domain.Tasks;
using DevFlow.Domain.Tickets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Features.Notifications;

public sealed record NotificationResponse(
    Guid Id,
    Guid OrganizationId,
    string Type,
    string Title,
    string? Body,
    string Link,
    UserSummary? Actor,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);

public sealed record UnreadCountResponse(int Count);

/// <summary>
/// Creates, lists and marks notifications.
/// </summary>
/// <remarks>
/// Creation happens in two steps. Services queue notifications on the current unit of work
/// (saved atomically with the change that caused them), then call <see cref="PublishPendingAsync"/>
/// after saving to push them over SignalR. Real-time delivery is best effort: if it fails, the
/// notification is still stored and appears on the next refresh.
/// </remarks>
public sealed class NotificationService(
    IAppDbContext db,
    ICurrentUser currentUser,
    INotificationPublisher publisher,
    TimeProvider clock,
    ILogger<NotificationService> logger)
{
    private readonly List<Notification> _pending = [];
    private string? _actorName;

    // ---------------------------------------------------------------- triggers

    public async Task TaskAssignedAsync(TaskItem task, string projectKey, Guid recipientId, CancellationToken cancellationToken) =>
        Queue(task.OrganizationId, recipientId, "task.assigned",
            $"{await ActorNameAsync(cancellationToken)} assigned you {projectKey}-{task.Number}", task.Title, TaskLink(task));

    public async Task TaskCommentedAsync(TaskItem task, string projectKey, string excerpt, CancellationToken cancellationToken)
    {
        foreach (var recipient in new[] { task.AssigneeId, task.ReporterId }.OfType<Guid>().Distinct())
        {
            if (recipient == currentUser.Id) continue;
            Queue(task.OrganizationId, recipient, "task.commented",
                $"{await ActorNameAsync(cancellationToken)} commented on {projectKey}-{task.Number}", excerpt, TaskLink(task));
        }
    }

    public void TaskDueSoon(TaskItem task, string projectKey, Guid recipientId) =>
        Queue(task.OrganizationId, recipientId, "task.due_soon",
            $"{projectKey}-{task.Number} is due {task.DueDate:MMM d}", task.Title, TaskLink(task), actorId: null);

    public async Task TicketAssignedAsync(Ticket ticket, Guid recipientId, CancellationToken cancellationToken) =>
        Queue(ticket.OrganizationId, recipientId, "ticket.assigned",
            $"{await ActorNameAsync(cancellationToken)} assigned you ticket #{ticket.Number}", ticket.Subject, TicketLink(ticket));

    public void TicketStatusChanged(Ticket ticket) =>
        Queue(ticket.OrganizationId, ticket.RequesterId, "ticket.status_changed",
            $"Ticket #{ticket.Number} is now {Humanize(ticket.Status.ToString())}", ticket.Subject, TicketLink(ticket));

    public async Task TicketCommentedAsync(Ticket ticket, string excerpt, bool internalNote, CancellationToken cancellationToken)
    {
        var recipients = internalNote
            ? new[] { ticket.AssigneeId }
            : new[] { ticket.RequesterId, ticket.AssigneeId };
        foreach (var recipient in recipients.OfType<Guid>().Distinct())
        {
            if (recipient == currentUser.Id) continue;
            Queue(ticket.OrganizationId, recipient, "ticket.commented",
                $"{await ActorNameAsync(cancellationToken)} replied on ticket #{ticket.Number}", excerpt, TicketLink(ticket));
        }
    }

    public void TicketCreated(Ticket ticket, IEnumerable<Guid> agentIds)
    {
        foreach (var agent in agentIds.Where(id => id != currentUser.Id))
        {
            Queue(ticket.OrganizationId, agent, "ticket.created",
                $"New {Humanize(ticket.Priority.ToString()).ToLowerInvariant()} priority ticket #{ticket.Number}", ticket.Subject, TicketLink(ticket));
        }
    }

    public void TicketEscalated(Ticket ticket, IEnumerable<Guid> agentIds)
    {
        foreach (var agent in agentIds)
        {
            Queue(ticket.OrganizationId, agent, "ticket.escalated",
                $"Ticket #{ticket.Number} is still unassigned", ticket.Subject, TicketLink(ticket), actorId: null);
        }
    }

    /// <summary>Pushes notifications queued in this request to connected clients. Call after SaveChanges.</summary>
    public async Task PublishPendingAsync(CancellationToken cancellationToken = default)
    {
        if (_pending.Count == 0) return;
        var batch = _pending.ToList();
        _pending.Clear();

        var actors = await db.Users.Where(u => batch.Select(n => n.ActorId).Contains(u.Id))
            .Select(u => new UserSummary(u.Id, u.DisplayName, u.Email!))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        foreach (var notification in batch)
        {
            try
            {
                await publisher.PublishAsync(notification.RecipientId,
                    ToResponse(notification, notification.ActorId is { } id ? actors.GetValueOrDefault(id) : null), cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Real-time delivery of notification {NotificationId} failed", notification.Id);
            }
        }
    }

    // ---------------------------------------------------------------- inbox

    public async Task<PagedResult<NotificationResponse>> ListAsync(bool unreadOnly, int? page, int? pageSize, CancellationToken cancellationToken)
    {
        var query = db.Notifications.Where(n => n.RecipientId == currentUser.Id);
        if (unreadOnly) query = query.Where(n => n.ReadAt == null);
        return await query
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NotificationResponse(
                n.Id, n.OrganizationId, n.Type, n.Title, n.Body, n.Link,
                db.Users.Where(u => u.Id == n.ActorId).Select(u => new UserSummary(u.Id, u.DisplayName, u.Email!)).FirstOrDefault(),
                n.CreatedAt, n.ReadAt))
            .ToPagedResultAsync(page, pageSize, cancellationToken);
    }

    public async Task<UnreadCountResponse> UnreadCountAsync(CancellationToken cancellationToken) =>
        new(await db.Notifications.CountAsync(n => n.RecipientId == currentUser.Id && n.ReadAt == null, cancellationToken));

    public async Task MarkReadAsync(Guid notificationId, CancellationToken cancellationToken)
    {
        var notification = await db.Notifications
            .SingleOrDefaultAsync(n => n.Id == notificationId && n.RecipientId == currentUser.Id, cancellationToken)
            ?? throw new NotFoundException("Notification");
        notification.MarkRead(clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkAllReadAsync(CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        // ExecuteUpdate runs a single UPDATE statement without loading the rows.
        await db.Notifications
            .Where(n => n.RecipientId == currentUser.Id && n.ReadAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.ReadAt, now), cancellationToken);
    }

    // ---------------------------------------------------------------- helpers

    /// <summary>The acting user's display name, loaded once per request (asynchronously: no blocking I/O).</summary>
    private async ValueTask<string> ActorNameAsync(CancellationToken cancellationToken) =>
        _actorName ??= currentUser.IsAuthenticated
            ? await db.Users.Where(u => u.Id == currentUser.Id).Select(u => u.DisplayName).SingleAsync(cancellationToken)
            : "DevFlow";

    private void Queue(Guid organizationId, Guid recipientId, string type, string title, string? body, string link, Guid? actorId = default)
    {
        var notification = new Notification
        {
            OrganizationId = organizationId,
            RecipientId = recipientId,
            ActorId = actorId ?? (currentUser.IsAuthenticated ? currentUser.Id : null),
            Type = type,
            Title = title,
            Body = body is { Length: > 200 } ? body[..197] + "…" : body,
            Link = link,
            CreatedAt = clock.GetUtcNow(),
        };
        db.Notifications.Add(notification);
        _pending.Add(notification);
    }

    private static string TaskLink(TaskItem task) => $"/app/projects/{task.ProjectId}?task={task.Id}";

    private static string TicketLink(Ticket ticket) => $"/app/tickets/{ticket.Id}";

    private static string Humanize(string pascalCase) =>
        string.Concat(pascalCase.Select((c, i) => i > 0 && char.IsUpper(c) ? " " + char.ToLowerInvariant(c) : c.ToString()));

    private static NotificationResponse ToResponse(Notification n, UserSummary? actor) =>
        new(n.Id, n.OrganizationId, n.Type, n.Title, n.Body, n.Link, actor, n.CreatedAt, n.ReadAt);
}
