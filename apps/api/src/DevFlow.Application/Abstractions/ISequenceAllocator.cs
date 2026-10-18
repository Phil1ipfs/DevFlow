namespace DevFlow.Application.Abstractions;

/// <summary>
/// Hands out human-friendly sequence numbers (WEB-42, ticket #17) atomically, so concurrent
/// requests can never receive the same number. Gaps are possible if a later step fails; that is
/// normal for such sequences and harmless.
/// </summary>
public interface ISequenceAllocator
{
    Task<int> NextTaskNumberAsync(Guid projectId, CancellationToken cancellationToken);

    Task<int> NextTicketNumberAsync(Guid organizationId, CancellationToken cancellationToken);
}
