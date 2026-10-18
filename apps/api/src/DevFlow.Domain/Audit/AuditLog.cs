using DevFlow.Domain.Common;

namespace DevFlow.Domain.Audit;

/// <summary>
/// An append-only record of a security-relevant or administrative action: who did what, to
/// which record, when and from where. Written in the same transaction as the change itself.
/// </summary>
public sealed class AuditLog : Entity
{
    /// <summary>Null for account-level events such as sign-ins.</summary>
    public Guid? OrganizationId { get; init; }

    public Guid? ActorId { get; init; }

    /// <summary>Dotted, stable event name, e.g. "member.role_changed".</summary>
    public required string Action { get; init; }

    public required string TargetType { get; init; }

    public Guid? TargetId { get; init; }

    /// <summary>Human-readable description shown in the audit log screen.</summary>
    public required string Summary { get; init; }

    /// <summary>Extra structured details (stored as JSONB).</summary>
    public Dictionary<string, string> Metadata { get; init; } = [];

    public string? IpAddress { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
