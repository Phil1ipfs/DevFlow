using DevFlow.Domain.Common;
using DevFlow.Domain.Users;

namespace DevFlow.Domain.Tickets;

/// <summary>An IT helpdesk request raised by someone in the organization.</summary>
public sealed class Ticket : Entity
{
    public Guid OrganizationId { get; init; }

    /// <summary>Per-organization sequence: ticket #17.</summary>
    public int Number { get; init; }

    public required string Subject { get; set; }

    public required string Description { get; set; }

    public TicketStatus Status { get; private set; } = TicketStatus.Open;

    public Priority Priority { get; set; } = Priority.Medium;

    public TicketCategory Category { get; set; } = TicketCategory.Other;

    public Guid RequesterId { get; init; }

    public Guid? AssigneeId { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>When an agent (not the requester) first replied; drives response-time reporting.</summary>
    public DateTimeOffset? FirstResponseAt { get; set; }

    public DateTimeOffset? ResolvedAt { get; private set; }

    /// <summary>Set by the SLA job when an unassigned urgent/high ticket has waited too long.</summary>
    public DateTimeOffset? EscalatedAt { get; set; }

    public User Requester { get; init; } = null!;

    public User? Assignee { get; init; }

    public bool IsOpen => Status is not (TicketStatus.Resolved or TicketStatus.Closed);

    public void ChangeStatus(TicketStatus status, DateTimeOffset now)
    {
        if (status == Status) return;
        Status = status;
        ResolvedAt = status is TicketStatus.Resolved or TicketStatus.Closed ? ResolvedAt ?? now : null;
    }
}

public enum TicketStatus
{
    Open = 0,
    InProgress = 1,
    WaitingOnRequester = 2,
    Resolved = 3,
    Closed = 4,
}

public enum TicketCategory
{
    Access = 0,
    Hardware = 1,
    Software = 2,
    Network = 3,
    Other = 4,
}

public sealed class TicketComment : Entity
{
    public Guid OrganizationId { get; init; }

    public Guid TicketId { get; init; }

    public Guid AuthorId { get; init; }

    public required string Body { get; init; }

    /// <summary>Internal notes are visible to admins (agents) only, never to the requester.</summary>
    public bool IsInternal { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public User Author { get; init; } = null!;
}
