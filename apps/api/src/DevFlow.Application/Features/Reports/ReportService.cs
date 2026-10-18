using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Common;
using DevFlow.Domain.Tasks;
using DevFlow.Domain.Tickets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace DevFlow.Application.Features.Reports;

public sealed record CountByKey(string Key, int Count);

public sealed record DailyPoint(DateOnly Date, int Created, int Completed);

public sealed record WorkloadRow(UserSummary User, int OpenTasks, int OpenTickets);

public sealed record TaskReport(
    int Open,
    int Overdue,
    int CompletedInPeriod,
    double? AverageCycleHours,
    IReadOnlyList<CountByKey> ByStatus,
    IReadOnlyList<CountByKey> ByPriority,
    IReadOnlyList<DailyPoint> Daily);

public sealed record TicketReport(
    int Open,
    int ResolvedInPeriod,
    double? AverageFirstResponseHours,
    double? AverageResolutionHours,
    IReadOnlyList<CountByKey> ByStatus,
    IReadOnlyList<CountByKey> ByCategory,
    IReadOnlyList<DailyPoint> Daily);

public sealed record OverviewReport(
    int Days,
    DateTimeOffset GeneratedAt,
    TaskReport Tasks,
    TicketReport Tickets,
    IReadOnlyList<WorkloadRow> Workload);

/// <summary>
/// Organization analytics. The aggregates run in PostgreSQL (GROUP BY), not in C#, and results are
/// cached for a minute with HybridCache: reports are the heaviest queries in the app, read often,
/// and a minute of staleness is acceptable on a dashboard.
/// </summary>
public sealed class ReportService(IAppDbContext db, OrganizationAccess access, HybridCache cache, TimeProvider clock)
{
    public static readonly int[] AllowedPeriods = [7, 30, 90];
    private static readonly HybridCacheEntryOptions CacheFor = new() { Expiration = TimeSpan.FromMinutes(1), LocalCacheExpiration = TimeSpan.FromMinutes(1) };

    public async Task<OverviewReport> OverviewAsync(Guid organizationId, int days, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        if (!AllowedPeriods.Contains(days)) throw new AppValidationException("days", "Choose 7, 30 or 90 days.");

        return await cache.GetOrCreateAsync(
            $"report:overview:{organizationId}:{days}",
            (organizationId, days),
            (state, ct) => new ValueTask<OverviewReport>(BuildAsync(state.organizationId, state.days, ct)),
            CacheFor,
            tags: [$"org:{organizationId}"],
            cancellationToken: cancellationToken);
    }

    private async Task<OverviewReport> BuildAsync(Guid organizationId, int days, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var since = now.AddDays(-days);
        var today = DateOnly.FromDateTime(now.UtcDateTime);

        var tasks = db.Tasks.Where(t => t.OrganizationId == organizationId && t.ArchivedAt == null && t.Project.ArchivedAt == null);
        var openTasks = tasks.Where(t => t.Status != TaskItemStatus.Done);

        var taskByStatus = await tasks.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
        var taskByPriority = await openTasks.GroupBy(t => t.Priority).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
        var overdue = await openTasks.CountAsync(t => t.DueDate != null && t.DueDate < today, cancellationToken);
        var completed = await tasks
            .Where(t => t.CompletedAt != null && t.CompletedAt >= since)
            .Select(t => new { t.CreatedAt, CompletedAt = t.CompletedAt!.Value })
            .ToListAsync(cancellationToken);
        var createdTaskDates = await tasks.Where(t => t.CreatedAt >= since).Select(t => t.CreatedAt).ToListAsync(cancellationToken);

        var tickets = db.Tickets.Where(t => t.OrganizationId == organizationId);
        var ticketByStatus = await tickets.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
        var ticketByCategory = await tickets.Where(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed)
            .GroupBy(t => t.Category).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
        var recentTickets = await tickets
            .Where(t => t.CreatedAt >= since || (t.ResolvedAt != null && t.ResolvedAt >= since))
            .Select(t => new { t.CreatedAt, t.FirstResponseAt, t.ResolvedAt })
            .ToListAsync(cancellationToken);

        var workload = await db.Memberships
            .Where(m => m.OrganizationId == organizationId)
            .Select(m => new WorkloadRow(
                new UserSummary(m.UserId, m.User.DisplayName, m.User.Email!),
                openTasks.Count(t => t.AssigneeId == m.UserId),
                tickets.Count(t => t.AssigneeId == m.UserId && t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed)))
            .ToListAsync(cancellationToken);

        var resolvedTickets = recentTickets.Where(t => t.ResolvedAt >= since).ToList();
        var respondedTickets = recentTickets.Where(t => t.FirstResponseAt != null && t.CreatedAt >= since).ToList();

        return new OverviewReport(
            days,
            now,
            new TaskReport(
                Open: taskByStatus.Where(s => s.Key != TaskItemStatus.Done).Sum(s => s.Count),
                Overdue: overdue,
                CompletedInPeriod: completed.Count,
                AverageCycleHours: completed.Count == 0 ? null : Math.Round(completed.Average(t => (t.CompletedAt - t.CreatedAt).TotalHours), 1),
                ByStatus: Enum.GetValues<TaskItemStatus>().Select(s => new CountByKey(s.ToString(), taskByStatus.FirstOrDefault(x => x.Key == s)?.Count ?? 0)).ToList(),
                ByPriority: Enum.GetValues<Priority>().Reverse().Select(p => new CountByKey(p.ToString(), taskByPriority.FirstOrDefault(x => x.Key == p)?.Count ?? 0)).ToList(),
                Daily: Daily(today, days, createdTaskDates, completed.Select(c => c.CompletedAt))),
            new TicketReport(
                Open: ticketByStatus.Where(s => s.Key is not (TicketStatus.Resolved or TicketStatus.Closed)).Sum(s => s.Count),
                ResolvedInPeriod: resolvedTickets.Count,
                AverageFirstResponseHours: respondedTickets.Count == 0 ? null : Math.Round(respondedTickets.Average(t => (t.FirstResponseAt!.Value - t.CreatedAt).TotalHours), 1),
                AverageResolutionHours: resolvedTickets.Count == 0 ? null : Math.Round(resolvedTickets.Average(t => (t.ResolvedAt!.Value - t.CreatedAt).TotalHours), 1),
                ByStatus: Enum.GetValues<TicketStatus>().Select(s => new CountByKey(s.ToString(), ticketByStatus.FirstOrDefault(x => x.Key == s)?.Count ?? 0)).ToList(),
                ByCategory: Enum.GetValues<TicketCategory>().Select(c => new CountByKey(c.ToString(), ticketByCategory.FirstOrDefault(x => x.Key == c)?.Count ?? 0)).ToList(),
                Daily: Daily(today, days, recentTickets.Where(t => t.CreatedAt >= since).Select(t => t.CreatedAt), resolvedTickets.Select(t => t.ResolvedAt!.Value))),
            workload.OrderByDescending(w => w.OpenTasks + w.OpenTickets).ThenBy(w => w.User.DisplayName).ToList());
    }

    /// <summary>One point per day (UTC), including days with no activity, so charts have no gaps.</summary>
    private static List<DailyPoint> Daily(DateOnly today, int days, IEnumerable<DateTimeOffset> created, IEnumerable<DateTimeOffset> completed)
    {
        var createdByDay = created.GroupBy(d => DateOnly.FromDateTime(d.UtcDateTime)).ToDictionary(g => g.Key, g => g.Count());
        var completedByDay = completed.GroupBy(d => DateOnly.FromDateTime(d.UtcDateTime)).ToDictionary(g => g.Key, g => g.Count());
        return Enumerable.Range(0, days)
            .Select(offset => today.AddDays(offset - days + 1))
            .Select(day => new DailyPoint(day, createdByDay.GetValueOrDefault(day), completedByDay.GetValueOrDefault(day)))
            .ToList();
    }
}
