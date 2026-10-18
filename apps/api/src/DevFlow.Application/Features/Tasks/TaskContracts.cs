using DevFlow.Application.Common;
using DevFlow.Domain.Common;
using DevFlow.Domain.Tasks;
using FluentValidation;

namespace DevFlow.Application.Features.Tasks;

/// <summary>A task as shown on boards and in lists.</summary>
public sealed record TaskSummary(
    Guid Id,
    Guid ProjectId,
    string Key,
    int Number,
    string Title,
    TaskItemStatus Status,
    Priority Priority,
    UserSummary? Assignee,
    DateOnly? DueDate,
    double Position,
    int CommentCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? ArchivedAt);

/// <summary>Everything about one task, for the detail view.</summary>
public sealed record TaskDetail(
    Guid Id,
    Guid OrganizationId,
    Guid ProjectId,
    string ProjectName,
    string Key,
    int Number,
    string Title,
    string? Description,
    TaskItemStatus Status,
    Priority Priority,
    UserSummary? Assignee,
    UserSummary Reporter,
    DateOnly? DueDate,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? ArchivedAt);

public sealed record BoardColumn(TaskItemStatus Status, IReadOnlyList<TaskSummary> Tasks);

public sealed record BoardResponse(Guid ProjectId, IReadOnlyList<BoardColumn> Columns);

public enum TaskSort
{
    Newest,
    Oldest,
    RecentlyUpdated,
    Priority,
    DueDate,
}

/// <summary>Query-string filters for task lists. All optional.</summary>
public sealed record TaskListQuery
{
    public TaskItemStatus[]? Status { get; init; }

    public Priority[]? Priority { get; init; }

    public Guid? AssigneeId { get; init; }

    public bool Unassigned { get; init; }

    /// <summary>Matches the title, or the key/number ("WEB-12" or "12").</summary>
    public string? Search { get; init; }

    public bool Archived { get; init; }

    public TaskSort Sort { get; init; } = TaskSort.Newest;

    public int? Page { get; init; }

    public int? PageSize { get; init; }
}

public sealed record CreateTaskRequest(
    string Title,
    string? Description,
    TaskItemStatus? Status,
    Priority? Priority,
    Guid? AssigneeId,
    DateOnly? DueDate);

/// <summary>Partial update: null means "leave unchanged". Use the Clear* flags to unset values.</summary>
public sealed record UpdateTaskRequest(
    string? Title = null,
    string? Description = null,
    TaskItemStatus? Status = null,
    Priority? Priority = null,
    Guid? AssigneeId = null,
    bool ClearAssignee = false,
    DateOnly? DueDate = null,
    bool ClearDueDate = false);

/// <summary>Drops a task into a column between two neighbours (either may be omitted).</summary>
public sealed record MoveTaskRequest(TaskItemStatus Status, Guid? BeforeTaskId, Guid? AfterTaskId);

public sealed record CommentResponse(Guid Id, Guid TaskId, UserSummary Author, string Body, DateTimeOffset CreatedAt, DateTimeOffset? EditedAt);

public sealed record CommentRequest(string Body);

public sealed record ActivityResponse(Guid Id, UserSummary Actor, string Type, IReadOnlyDictionary<string, string> Data, DateTimeOffset CreatedAt);

public sealed class CreateTaskRequestValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(10_000);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Priority).IsInEnum();
    }
}

public sealed class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200).When(x => x.Title is not null);
        RuleFor(x => x.Description).MaximumLength(10_000);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Priority).IsInEnum();
    }
}

public sealed class MoveTaskRequestValidator : AbstractValidator<MoveTaskRequest>
{
    public MoveTaskRequestValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x).Must(x => x.BeforeTaskId is null || x.BeforeTaskId != x.AfterTaskId)
            .WithMessage("Before and after must be different tasks.");
    }
}

public sealed class CommentRequestValidator : AbstractValidator<CommentRequest>
{
    public CommentRequestValidator() => RuleFor(x => x.Body).NotEmpty().MaximumLength(5_000);
}
