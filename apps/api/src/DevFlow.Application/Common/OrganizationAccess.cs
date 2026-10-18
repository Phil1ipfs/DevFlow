using DevFlow.Application.Abstractions;
using DevFlow.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Common;

/// <summary>
/// The single place that decides whether the current user may act inside an organization.
/// Every service calls it before touching organization data. This is DevFlow's tenant isolation.
/// </summary>
public sealed class OrganizationAccess(IAppDbContext db, ICurrentUser currentUser)
{
    /// <summary>
    /// Returns the caller's membership, or throws.
    /// Non-members get 404 rather than 403, so they cannot even learn that the organization
    /// (or the project, task or ticket being looked up) exists.
    /// </summary>
    public async Task<Membership> RequireAsync(
        Guid organizationId,
        OrganizationRole minimumRole = OrganizationRole.Member,
        CancellationToken cancellationToken = default)
    {
        var membership = await db.Memberships
            .AsNoTracking()
            .SingleOrDefaultAsync(m => m.OrganizationId == organizationId && m.UserId == currentUser.Id, cancellationToken)
            ?? throw new NotFoundException("Organization");

        if (membership.Role < minimumRole)
        {
            throw new ForbiddenException(minimumRole switch
            {
                OrganizationRole.Owner => "Only organization owners can do this.",
                _ => "Only organization admins can do this.",
            });
        }

        return membership;
    }
}
