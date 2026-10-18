using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Audit;

public sealed record AuditLogResponse(
    Guid Id,
    string Action,
    string Summary,
    UserSummary? Actor,
    string TargetType,
    Guid? TargetId,
    IReadOnlyDictionary<string, string> Metadata,
    string? IpAddress,
    DateTimeOffset CreatedAt);

public sealed record AuditLogQuery
{
    /// <summary>Exact action ("member.role_changed") or a prefix ending in a dot ("member.").</summary>
    public string? Action { get; init; }

    public Guid? ActorId { get; init; }

    public int? Page { get; init; }

    public int? PageSize { get; init; }
}

/// <summary>Read side of the audit trail. Admins only: it shows who did what, from where.</summary>
public sealed class AuditLogService(IAppDbContext db, OrganizationAccess access)
{
    public async Task<PagedResult<AuditLogResponse>> ListAsync(Guid organizationId, AuditLogQuery query, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);

        var logs = db.AuditLogs.Where(a => a.OrganizationId == organizationId);
        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            var action = query.Action.Trim();
            logs = action.EndsWith('.') ? logs.Where(a => a.Action.StartsWith(action)) : logs.Where(a => a.Action == action);
        }
        if (query.ActorId is { } actorId) logs = logs.Where(a => a.ActorId == actorId);

        var page = await logs
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id, a.Action, a.Summary, a.TargetType, a.TargetId, a.Metadata, a.IpAddress, a.CreatedAt,
                // Left join: the actor may since have deleted their account.
                Actor = db.Users.Where(u => u.Id == a.ActorId).Select(u => new UserSummary(u.Id, u.DisplayName, u.Email!)).FirstOrDefault(),
            })
            .ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);

        return new PagedResult<AuditLogResponse>(
            page.Items.Select(a => new AuditLogResponse(a.Id, a.Action, a.Summary, a.Actor, a.TargetType, a.TargetId, a.Metadata, a.IpAddress, a.CreatedAt)).ToList(),
            page.Page, page.PageSize, page.TotalCount);
    }
}
