using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Organizations;

/// <summary>
/// Use cases for organizations (workspaces). A service holds business rules; the controller in
/// front of it only translates HTTP to method calls.
/// </summary>
public sealed class OrganizationService(
    IAppDbContext db,
    ICurrentUser currentUser,
    OrganizationAccess access,
    AuditTrail audit,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<OrganizationResponse>> ListMineAsync(CancellationToken cancellationToken)
    {
        // A projection (Select into a DTO) makes EF generate SQL for exactly these columns.
        return await db.Memberships
            .Where(m => m.UserId == currentUser.Id)
            .OrderBy(m => m.Organization.Name)
            .Select(m => new OrganizationResponse(
                m.OrganizationId,
                m.Organization.Name,
                m.Role,
                m.Organization.Members.Count,
                m.Organization.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<OrganizationResponse> GetAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        return await QueryAsync(organizationId, cancellationToken);
    }

    public async Task<OrganizationResponse> CreateAsync(CreateOrganizationRequest request, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var organization = new Organization
        {
            Name = request.Name.Trim(),
            CreatedAt = now,
            CreatedById = currentUser.Id,
        };
        organization.Members.Add(new Membership { UserId = currentUser.Id, Role = OrganizationRole.Owner, JoinedAt = now });
        db.Organizations.Add(organization);

        audit.Record(organization.Id, "organization.created", "organization", organization.Id,
            $"Created organization \"{organization.Name}\"");
        await db.SaveChangesAsync(cancellationToken);

        return await QueryAsync(organization.Id, cancellationToken);
    }

    public async Task<OrganizationResponse> UpdateAsync(Guid organizationId, UpdateOrganizationRequest request, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);
        var organization = await db.Organizations.SingleAsync(o => o.Id == organizationId, cancellationToken);

        var oldName = organization.Name;
        organization.Name = request.Name.Trim();
        if (oldName != organization.Name)
        {
            audit.Record(organizationId, "organization.renamed", "organization", organizationId,
                $"Renamed organization from \"{oldName}\" to \"{organization.Name}\"",
                new() { ["from"] = oldName, ["to"] = organization.Name });
        }
        await db.SaveChangesAsync(cancellationToken);

        return await QueryAsync(organizationId, cancellationToken);
    }

    private Task<OrganizationResponse> QueryAsync(Guid organizationId, CancellationToken cancellationToken) =>
        db.Memberships
            .Where(m => m.OrganizationId == organizationId && m.UserId == currentUser.Id)
            .Select(m => new OrganizationResponse(
                m.OrganizationId, m.Organization.Name, m.Role, m.Organization.Members.Count, m.Organization.CreatedAt))
            .SingleAsync(cancellationToken);
}
