using DevFlow.Application.Abstractions;
using DevFlow.Application.Features.Notifications;
using DevFlow.Domain.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tasks;
using DevFlow.Domain.Tickets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.BackgroundJobs;

/// <summary>Reminds assignees once when an unfinished task is due today or tomorrow.</summary>
public sealed class DueDateReminderJob(IServiceScopeFactory scopes, IOptions<BackgroundJobOptions> options, ILogger<DueDateReminderJob> logger)
    : RecurringJob(scopes, options, logger)
{
    protected override TimeSpan Interval => TimeSpan.FromMinutes(15);

    protected override async Task ExecuteOnceAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<IAppDbContext>();
        var notifications = services.GetRequiredService<NotificationService>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var tomorrow = DateOnly.FromDateTime(now.UtcDateTime).AddDays(1);

        var due = await db.Tasks
            .Include(t => t.Project)
            .Where(t => t.DueDate != null && t.DueDate <= tomorrow && t.AssigneeId != null && t.DueReminderSentAt == null
                        && t.Status != TaskItemStatus.Done && t.ArchivedAt == null && t.Project.ArchivedAt == null)
            .OrderBy(t => t.DueDate)
            .Take(500)
            .ToListAsync(cancellationToken);

        foreach (var task in due)
        {
            notifications.TaskDueSoon(task, task.Project.Key, task.AssigneeId!.Value);
            task.DueReminderSentAt = now;
        }

        if (due.Count == 0) return;
        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        logger.LogInformation("Sent {Count} due-date reminders", due.Count);
    }
}

/// <summary>
/// Escalates unassigned high-priority tickets that have waited too long (urgent: 30 minutes,
/// high: 2 hours) by notifying every admin of the organization, once per ticket.
/// </summary>
public sealed class TicketEscalationJob(IServiceScopeFactory scopes, IOptions<BackgroundJobOptions> options, ILogger<TicketEscalationJob> logger)
    : RecurringJob(scopes, options, logger)
{
    public static readonly TimeSpan UrgentThreshold = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan HighThreshold = TimeSpan.FromHours(2);

    protected override TimeSpan Interval => TimeSpan.FromMinutes(5);

    protected override async Task ExecuteOnceAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<IAppDbContext>();
        var notifications = services.GetRequiredService<NotificationService>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var urgentBefore = now - UrgentThreshold;
        var highBefore = now - HighThreshold;

        var waiting = await db.Tickets
            .Where(t => t.AssigneeId == null && t.EscalatedAt == null
                        && (t.Status == TicketStatus.Open || t.Status == TicketStatus.InProgress)
                        && ((t.Priority == Priority.Urgent && t.CreatedAt <= urgentBefore)
                            || (t.Priority == Priority.High && t.CreatedAt <= highBefore)))
            .Take(200)
            .ToListAsync(cancellationToken);
        if (waiting.Count == 0) return;

        var organizationIds = waiting.Select(t => t.OrganizationId).Distinct().ToList();
        var agents = await db.Memberships
            .Where(m => organizationIds.Contains(m.OrganizationId) && m.Role >= OrganizationRole.Admin)
            .Select(m => new { m.OrganizationId, m.UserId })
            .ToListAsync(cancellationToken);

        foreach (var ticket in waiting)
        {
            notifications.TicketEscalated(ticket, agents.Where(a => a.OrganizationId == ticket.OrganizationId).Select(a => a.UserId));
            ticket.EscalatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        logger.LogInformation("Escalated {Count} unassigned tickets", waiting.Count);
    }
}

/// <summary>Deletes stale rows: finished invitations after 30 days, read notifications after 90.</summary>
public sealed class DataRetentionJob(IServiceScopeFactory scopes, IOptions<BackgroundJobOptions> options, ILogger<DataRetentionJob> logger)
    : RecurringJob(scopes, options, logger)
{
    protected override TimeSpan Interval => TimeSpan.FromHours(6);

    protected override async Task ExecuteOnceAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<IAppDbContext>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var invitationCutoff = now.AddDays(-30);
        var notificationCutoff = now.AddDays(-90);

        // ExecuteDelete issues one DELETE statement; nothing is loaded into memory.
        var invitations = await db.Invitations
            .Where(i => i.ExpiresAt < invitationCutoff || i.RevokedAt < invitationCutoff || i.AcceptedAt < invitationCutoff)
            .ExecuteDeleteAsync(cancellationToken);
        var notifications = await db.Notifications
            .Where(n => n.ReadAt != null && n.ReadAt < notificationCutoff)
            .ExecuteDeleteAsync(cancellationToken);

        if (invitations + notifications > 0)
        {
            logger.LogInformation("Retention removed {Invitations} invitations and {Notifications} notifications", invitations, notifications);
        }
    }
}
