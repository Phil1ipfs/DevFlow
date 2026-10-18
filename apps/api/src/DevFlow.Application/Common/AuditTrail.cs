using DevFlow.Application.Abstractions;
using DevFlow.Domain.Audit;

namespace DevFlow.Application.Common;

/// <summary>
/// Adds audit entries to the current unit of work. They are saved by the caller's own
/// SaveChangesAsync, so an action and its audit record are committed together or not at all.
/// </summary>
public sealed class AuditTrail(IAppDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    public void Record(
        Guid? organizationId,
        string action,
        string targetType,
        Guid? targetId,
        string summary,
        Dictionary<string, string>? metadata = null,
        Guid? actorId = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = organizationId,
            ActorId = actorId ?? (currentUser.IsAuthenticated ? currentUser.Id : null),
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Summary = summary,
            Metadata = metadata ?? [],
            IpAddress = currentUser.IpAddress,
            CreatedAt = clock.GetUtcNow(),
        });
    }
}
