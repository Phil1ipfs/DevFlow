using DevFlow.Domain.Common;

namespace DevFlow.Domain.Organizations;

/// <summary>
/// An emailed invitation to join an organization. Only a SHA-256 hash of the token is stored,
/// so a database leak does not expose usable invitation links.
/// </summary>
public sealed class Invitation : Entity
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public Guid OrganizationId { get; init; }

    public required string Email { get; init; }

    public OrganizationRole Role { get; init; }

    public required string TokenHash { get; init; }

    public Guid InvitedById { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? AcceptedAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }

    public Organization Organization { get; init; } = null!;

    public Users.User InvitedBy { get; init; } = null!;

    public InvitationStatus StatusAt(DateTimeOffset now) =>
        AcceptedAt is not null ? InvitationStatus.Accepted
        : RevokedAt is not null ? InvitationStatus.Revoked
        : now >= ExpiresAt ? InvitationStatus.Expired
        : InvitationStatus.Pending;

    public void Accept(DateTimeOffset now) => AcceptedAt = now;

    public void Revoke(DateTimeOffset now) => RevokedAt = now;
}

public enum InvitationStatus
{
    Pending,
    Accepted,
    Revoked,
    Expired,
}
