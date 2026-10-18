using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Common;

/// <summary>One page of results plus the information a UI needs to render pagination.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 1 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class Paging
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 100;

    /// <summary>Clamps client-supplied paging values to safe bounds.</summary>
    public static (int Page, int PageSize) Normalize(int? page, int? pageSize) =>
        (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize));

    /// <summary>Counts and fetches one page in two queries. The query must already be ordered.</summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> query, int? page, int? pageSize, CancellationToken cancellationToken)
    {
        var (p, size) = Normalize(page, pageSize);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((p - 1) * size).Take(size).ToListAsync(cancellationToken);
        return new PagedResult<T>(items, p, size, total);
    }
}

/// <summary>Compact user reference embedded in other responses.</summary>
public sealed record UserSummary(Guid Id, string DisplayName, string Email);
