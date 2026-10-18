using DevFlow.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence;

/// <summary>
/// Increments a counter column and returns the previous value in one statement. PostgreSQL
/// row-locks the updated row, so concurrent callers are serialized and each gets a distinct number.
/// </summary>
internal sealed class SequenceAllocator(DevFlowDbContext db) : ISequenceAllocator
{
    // The interpolated values become SQL parameters, not string concatenation, so this is not
    // open to SQL injection. "Value" is the column name EF expects for scalar SqlQuery results.
    public async Task<int> NextTaskNumberAsync(Guid projectId, CancellationToken cancellationToken) =>
        (await db.Database.SqlQuery<int>(
                $"""UPDATE projects SET next_task_number = next_task_number + 1 WHERE id = {projectId} RETURNING next_task_number - 1 AS "Value" """)
            .ToListAsync(cancellationToken)).Single();

    public async Task<int> NextTicketNumberAsync(Guid organizationId, CancellationToken cancellationToken) =>
        (await db.Database.SqlQuery<int>(
                $"""UPDATE organizations SET next_ticket_number = next_ticket_number + 1 WHERE id = {organizationId} RETURNING next_ticket_number - 1 AS "Value" """)
            .ToListAsync(cancellationToken)).Single();
}
