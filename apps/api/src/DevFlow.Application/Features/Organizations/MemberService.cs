using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Organizations;

/// <summary>
/// Membership rules:
/// <list type="bullet">
/// <item>Admins manage members; only owners can grant, change or remove the Owner and Admin roles of others.</item>
/// <item>Anyone can leave, but an organization always keeps at least one owner.</item>
/// </list>
/// </summary>
public sealed class MemberService(IAppDbContext db, ICurrentUser currentUser, OrganizationAccess access, AuditTrail audit)
{
    public async Task<IReadOnlyList<MemberResponse>> ListAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        return await db.Memberships
            .Where(m => m.OrganizationId == organizationId)
            .OrderByDescending(m => m.Role).ThenBy(m => m.User.DisplayName)
            .Select(m => new MemberResponse(m.UserId, m.User.DisplayName, m.User.Email!, m.Role, m.JoinedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<MemberResponse> ChangeRoleAsync(Guid organizationId, Guid userId, OrganizationRole newRole, CancellationToken cancellationToken)
    {
        var caller = await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);
        var member = await FindAsync(organizationId, userId, cancellationToken);
        var oldRole = member.Role;
        if (oldRole == newRole) return ToResponse(member);

        // Admins may only move people between Member and Admin; anything involving Owner needs an owner.
        if ((oldRole == OrganizationRole.Owner || newRole == OrganizationRole.Owner) && caller.Role != OrganizationRole.Owner)
        {
            throw new ForbiddenException("Only owners can grant or remove the Owner role.");
        }
        if (oldRole == OrganizationRole.Admin && caller.Role != OrganizationRole.Owner && userId != caller.UserId)
        {
            throw new ForbiddenException("Only owners can change another admin's role.");
        }
        if (oldRole == OrganizationRole.Owner)
        {
            await EnsureAnotherOwnerAsync(organizationId, userId, "demote", cancellationToken);
        }

        member.Role = newRole;
        audit.Record(organizationId, "member.role_changed", "user", userId,
            $"Changed {member.User.DisplayName}'s role from {oldRole} to {newRole}",
            new() { ["from"] = oldRole.ToString(), ["to"] = newRole.ToString() });
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(member);
    }

    public async Task RemoveAsync(Guid organizationId, Guid userId, CancellationToken cancellationToken)
    {
        var isSelf = userId == currentUser.Id;
        var caller = await access.RequireAsync(organizationId,
            isSelf ? OrganizationRole.Member : OrganizationRole.Admin, cancellationToken);
        var member = await FindAsync(organizationId, userId, cancellationToken);

        if (!isSelf && member.Role >= OrganizationRole.Admin && caller.Role != OrganizationRole.Owner)
        {
            throw new ForbiddenException("Only owners can remove admins or owners.");
        }
        if (member.Role == OrganizationRole.Owner)
        {
            await EnsureAnotherOwnerAsync(organizationId, userId, isSelf ? "leave" : "remove", cancellationToken);
        }

        db.Memberships.Remove(member);
        audit.Record(organizationId, isSelf ? "member.left" : "member.removed", "user", userId,
            isSelf ? $"{member.User.DisplayName} left the organization" : $"Removed {member.User.DisplayName} from the organization");
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Membership> FindAsync(Guid organizationId, Guid userId, CancellationToken cancellationToken) =>
        await db.Memberships.Include(m => m.User)
            .SingleOrDefaultAsync(m => m.OrganizationId == organizationId && m.UserId == userId, cancellationToken)
        ?? throw new NotFoundException("Member");

    private async Task EnsureAnotherOwnerAsync(Guid organizationId, Guid exceptUserId, string verb, CancellationToken cancellationToken)
    {
        var otherOwners = await db.Memberships.CountAsync(
            m => m.OrganizationId == organizationId && m.Role == OrganizationRole.Owner && m.UserId != exceptUserId,
            cancellationToken);
        if (otherOwners == 0)
        {
            throw new ConflictException($"Cannot {verb} the last owner. Make someone else an owner first.");
        }
    }

    private static MemberResponse ToResponse(Membership m) =>
        new(m.UserId, m.User.DisplayName, m.User.Email!, m.Role, m.JoinedAt);
}
