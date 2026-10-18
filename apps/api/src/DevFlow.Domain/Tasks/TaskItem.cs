using DevFlow.Domain.Common;
using DevFlow.Domain.Projects;
using DevFlow.Domain.Users;

namespace DevFlow.Domain.Tasks;

/// <summary>
/// A unit of work on a project's board. Named TaskItem because "Task" would clash with
/// System.Threading.Tasks.Task, which every async C# method uses.
/// </summary>
public sealed class TaskItem : Entity
{
    public Guid OrganizationId { get; init; }

    public Guid ProjectId { get; init; }

    /// <summary>Per-project sequence number: the 42 in WEB-42.</summary>
    public int Number { get; init; }

    public required string Title { get; set; }

    public string? Description { get; set; }

    public TaskItemStatus Status { get; private set; } = TaskItemStatus.Todo;

    public Priority Priority { get; set; } = Priority.None;

    public Guid? AssigneeId { get; set; }

    public Guid ReporterId { get; init; }

    public DateOnly? DueDate { get; set; }

    /// <summary>
    /// Order within the status column. Fractional, so moving a card between two others only
    /// updates that one row: its position becomes the midpoint of its new neighbours.
    /// </summary>
    public double Position { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    /// <summary>Set by the due-date reminder job so each task is reminded at most once.</summary>
    public DateTimeOffset? DueReminderSentAt { get; set; }

    public Project Project { get; init; } = null!;

    public User? Assignee { get; init; }

    public User Reporter { get; init; } = null!;

    public bool IsArchived => ArchivedAt is not null;

    public void ChangeStatus(TaskItemStatus status, DateTimeOffset now)
    {
        if (status == Status) return;
        Status = status;
        CompletedAt = status == TaskItemStatus.Done ? now : null;
    }

    public void Archive(DateTimeOffset now) => ArchivedAt ??= now;

    public void Restore() => ArchivedAt = null;
}

/// <summary>Board columns, in display order.</summary>
public enum TaskItemStatus
{
    Backlog = 0,
    Todo = 1,
    InProgress = 2,
    InReview = 3,
    Done = 4,
}
