using DevFlow.Domain.Common;
using DevFlow.Domain.Users;

namespace DevFlow.Domain.Tasks;

public sealed class TaskComment : Entity
{
    public Guid OrganizationId { get; init; }

    public Guid TaskId { get; init; }

    public Guid AuthorId { get; init; }

    public required string Body { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? EditedAt { get; set; }

    public User Author { get; init; } = null!;
}

/// <summary>
/// One entry in a task's history ("Ana moved WEB-4 to Done"). User-facing, unlike the
/// security-focused audit log.
/// </summary>
public sealed class TaskActivity : Entity
{
    public Guid OrganizationId { get; init; }

    public Guid TaskId { get; init; }

    public Guid ActorId { get; init; }

    /// <summary>e.g. "created", "status_changed", "assigned".</summary>
    public required string Type { get; init; }

    /// <summary>Type-specific details such as { "from": "Todo", "to": "Done" }.</summary>
    public Dictionary<string, string> Data { get; init; } = [];

    public DateTimeOffset CreatedAt { get; init; }

    public User Actor { get; init; } = null!;
}
