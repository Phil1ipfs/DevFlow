namespace DevFlow.Domain.Common;

/// <summary>
/// Base type for every domain entity that is persisted with its own identity.
/// </summary>
/// <remarks>
/// Ids are UUID version 7: globally unique like any UUID, but time-ordered, so
/// new rows append to the end of the primary-key index instead of landing at
/// random positions (which is what makes random v4 UUIDs slow for inserts).
/// </remarks>
public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.CreateVersion7();
}
