using DevFlow.Domain.Common;
using DevFlow.Domain.Users;

namespace DevFlow.Domain.Projects;

/// <summary>A body of work inside an organization. Tasks are numbered per project: KEY-1, KEY-2, …</summary>
public sealed class Project : Entity
{
    public Guid OrganizationId { get; init; }

    public required string Name { get; set; }

    /// <summary>Short uppercase prefix for task numbers, e.g. "WEB" in WEB-42. Unique per organization.</summary>
    public required string Key { get; init; }

    public string? Description { get; set; }

    public Guid? LeadId { get; set; }

    public User? Lead { get; set; }

    /// <summary>
    /// The number the next task in this project receives. Incremented atomically in SQL
    /// (UPDATE ... RETURNING) when a task is created, never in C#, so concurrent requests
    /// can never hand out the same number.
    /// </summary>
    public int NextTaskNumber { get; private set; } = 1;

    public DateTimeOffset CreatedAt { get; init; }

    public Guid CreatedById { get; init; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    public bool IsArchived => ArchivedAt is not null;

    public void Archive(DateTimeOffset now) => ArchivedAt ??= now;

    public void Restore() => ArchivedAt = null;
}
