using DevFlow.Application.Common;
using DevFlow.Domain.Common;
using DevFlow.Domain.Tickets;
using FluentValidation;

namespace DevFlow.Application.Features.Tickets;

public sealed record TicketSummary(
    Guid Id,
    int Number,
    string Subject,
    TicketStatus Status,
    Priority Priority,
    TicketCategory Category,
    UserSummary Requester,
    UserSummary? Assignee,
    int CommentCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record TicketDetail(
    Guid Id,
    Guid OrganizationId,
    int Number,
    string Subject,
    string Description,
    TicketStatus Status,
    Priority Priority,
    TicketCategory Category,
    UserSummary Requester,
    UserSummary? Assignee,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? FirstResponseAt,
    DateTimeOffset? ResolvedAt,
    TicketPermissions Permissions);

/// <summary>What the current user may do with this ticket, so the UI never offers forbidden actions.</summary>
public sealed record TicketPermissions(bool CanTriage, bool CanEditDetails, bool CanChangeStatus, bool CanAddInternalNotes);

public sealed record TicketCommentResponse(Guid Id, UserSummary Author, string Body, bool IsInternal, DateTimeOffset CreatedAt);

public enum TicketScope
{
    /// <summary>Everything the caller may see (the whole queue for admins).</summary>
    All,

    /// <summary>Tickets the caller raised.</summary>
    Requested,

    /// <summary>Tickets assigned to the caller.</summary>
    Assigned,
}

public sealed record TicketListQuery
{
    public TicketScope Scope { get; init; } = TicketScope.All;

    public TicketStatus[]? Status { get; init; }

    public Priority[]? Priority { get; init; }

    public TicketCategory? Category { get; init; }

    public bool Unassigned { get; init; }

    /// <summary>Matches the subject, or the number ("#17" or "17").</summary>
    public string? Search { get; init; }

    public int? Page { get; init; }

    public int? PageSize { get; init; }
}

public sealed record CreateTicketRequest(string Subject, string Description, Priority? Priority, TicketCategory? Category);

public sealed record UpdateTicketRequest(
    string? Subject = null,
    string? Description = null,
    TicketStatus? Status = null,
    Priority? Priority = null,
    TicketCategory? Category = null,
    Guid? AssigneeId = null,
    bool ClearAssignee = false);

public sealed record TicketCommentRequest(string Body, bool IsInternal = false);

public sealed class CreateTicketRequestValidator : AbstractValidator<CreateTicketRequest>
{
    public CreateTicketRequestValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(10_000);
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.Category).IsInEnum();
    }
}

public sealed class UpdateTicketRequestValidator : AbstractValidator<UpdateTicketRequest>
{
    public UpdateTicketRequestValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200).When(x => x.Subject is not null);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(10_000).When(x => x.Description is not null);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.Category).IsInEnum();
    }
}

public sealed class TicketCommentRequestValidator : AbstractValidator<TicketCommentRequest>
{
    public TicketCommentRequestValidator() => RuleFor(x => x.Body).NotEmpty().MaximumLength(5_000);
}
