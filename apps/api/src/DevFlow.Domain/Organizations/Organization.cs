using DevFlow.Domain.Common;

namespace DevFlow.Domain.Organizations;

/// <summary>A workspace. Every project, task and ticket belongs to exactly one organization.</summary>
public sealed class Organization : Entity
{
    public required string Name { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public Guid CreatedById { get; init; }

    /// <summary>Next helpdesk ticket number; incremented atomically in SQL, like project task numbers.</summary>
    public int NextTicketNumber { get; private set; } = 1;

    public List<Membership> Members { get; init; } = [];
}

/// <summary>
/// Roles are ordered by privilege, so "at least Admin" is a simple comparison
/// (<c>role &gt;= OrganizationRole.Admin</c>).
/// </summary>
public enum OrganizationRole
{
    /// <summary>Works on projects, tasks and tickets.</summary>
    Member = 0,

    /// <summary>Also manages projects, members, invitations and the helpdesk queue.</summary>
    Admin = 1,

    /// <summary>Also manages admins and owners. Every organization keeps at least one.</summary>
    Owner = 2,
}

/// <summary>A user's membership in an organization (composite key: organization + user).</summary>
public sealed class Membership
{
    public Guid OrganizationId { get; init; }

    public Guid UserId { get; init; }

    public OrganizationRole Role { get; set; }

    public DateTimeOffset JoinedAt { get; init; }

    public Organization Organization { get; init; } = null!;

    public Users.User User { get; init; } = null!;
}
