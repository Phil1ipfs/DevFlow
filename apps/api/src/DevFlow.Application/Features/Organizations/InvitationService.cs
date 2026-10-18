using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Organizations;

public sealed class InvitationService(
    IAppDbContext db,
    ICurrentUser currentUser,
    OrganizationAccess access,
    AuditTrail audit,
    IEmailSender emailSender,
    IAppUrls urls,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<InvitationResponse>> ListPendingAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);
        var now = clock.GetUtcNow();
        return await db.Invitations
            .Where(i => i.OrganizationId == organizationId && i.AcceptedAt == null && i.RevokedAt == null && i.ExpiresAt > now)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new InvitationResponse(i.Id, i.Email, i.Role,
                new UserSummary(i.InvitedById, i.InvitedBy.DisplayName, i.InvitedBy.Email!), i.CreatedAt, i.ExpiresAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<InvitationResponse> CreateAsync(Guid organizationId, CreateInvitationRequest request, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);
        var email = request.Email.Trim().ToLowerInvariant();
        var now = clock.GetUtcNow();

        var alreadyMember = await db.Memberships.AnyAsync(
            m => m.OrganizationId == organizationId && m.User.NormalizedEmail == email.ToUpperInvariant(), cancellationToken);
        if (alreadyMember)
        {
            throw new ConflictException($"{email} is already a member of this organization.");
        }

        // Inviting the same address again replaces the earlier invitation (and its link).
        var previous = await db.Invitations
            .Where(i => i.OrganizationId == organizationId && i.Email == email && i.AcceptedAt == null && i.RevokedAt == null)
            .ToListAsync(cancellationToken);
        previous.ForEach(i => i.Revoke(now));

        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var invitation = new Invitation
        {
            OrganizationId = organizationId,
            Email = email,
            Role = request.Role,
            TokenHash = Hash(token),
            InvitedById = currentUser.Id,
            CreatedAt = now,
            ExpiresAt = now + Invitation.Lifetime,
        };
        db.Invitations.Add(invitation);
        audit.Record(organizationId, "invitation.created", "invitation", invitation.Id,
            $"Invited {email} as {request.Role}", new() { ["email"] = email, ["role"] = request.Role.ToString() });
        await db.SaveChangesAsync(cancellationToken);

        var details = await db.Invitations.Where(i => i.Id == invitation.Id)
            .Select(i => new { OrganizationName = i.Organization.Name, InviterName = i.InvitedBy.DisplayName, InviterEmail = i.InvitedBy.Email! })
            .SingleAsync(cancellationToken);

        await emailSender.SendAsync(new EmailMessage(
            email,
            $"{details.InviterName} invited you to {details.OrganizationName} on DevFlow",
            $"""
            {details.InviterName} invited you to join {details.OrganizationName} on DevFlow as {request.Role.ToString().ToLowerInvariant()}.

            Accept the invitation (valid for 7 days):
            {urls.Web($"/invite/{token}")}

            If you weren't expecting this, you can ignore this email.
            """), cancellationToken);

        return new InvitationResponse(invitation.Id, email, request.Role,
            new UserSummary(currentUser.Id, details.InviterName, details.InviterEmail), invitation.CreatedAt, invitation.ExpiresAt);
    }

    public async Task RevokeAsync(Guid organizationId, Guid invitationId, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);
        var invitation = await db.Invitations
            .SingleOrDefaultAsync(i => i.Id == invitationId && i.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Invitation");

        invitation.Revoke(clock.GetUtcNow());
        audit.Record(organizationId, "invitation.revoked", "invitation", invitationId, $"Revoked the invitation for {invitation.Email}");
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Public preview for the invitation page (the token itself is the credential).</summary>
    public async Task<InvitationPreviewResponse> PreviewAsync(string token, CancellationToken cancellationToken)
    {
        var invitation = await FindByTokenAsync(token, cancellationToken);
        return new InvitationPreviewResponse(
            invitation.Organization.Name,
            invitation.InvitedBy.DisplayName,
            invitation.Email,
            invitation.Role,
            invitation.StatusAt(clock.GetUtcNow()),
            invitation.ExpiresAt);
    }

    public async Task<AcceptInvitationResponse> AcceptAsync(string token, CancellationToken cancellationToken)
    {
        var invitation = await FindByTokenAsync(token, cancellationToken);
        var now = clock.GetUtcNow();
        var status = invitation.StatusAt(now);
        if (status != InvitationStatus.Pending)
        {
            throw new ConflictException(status switch
            {
                InvitationStatus.Accepted => "This invitation has already been used.",
                InvitationStatus.Revoked => "This invitation was withdrawn. Ask an admin for a new one.",
                _ => "This invitation has expired. Ask an admin for a new one.",
            });
        }

        var user = await db.Users.SingleAsync(u => u.Id == currentUser.Id, cancellationToken);
        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException($"This invitation was sent to {invitation.Email}. Sign in with that account to accept it.");
        }

        var alreadyMember = await db.Memberships.AnyAsync(
            m => m.OrganizationId == invitation.OrganizationId && m.UserId == user.Id, cancellationToken);
        if (!alreadyMember)
        {
            db.Memberships.Add(new Membership
            {
                OrganizationId = invitation.OrganizationId,
                UserId = user.Id,
                Role = invitation.Role,
                JoinedAt = now,
            });
            audit.Record(invitation.OrganizationId, "member.joined", "user", user.Id,
                $"{user.DisplayName} joined as {invitation.Role} (invited by {invitation.InvitedBy.DisplayName})");
        }

        invitation.Accept(now);
        await db.SaveChangesAsync(cancellationToken);
        return new AcceptInvitationResponse(invitation.OrganizationId, invitation.Organization.Name);
    }

    private async Task<Invitation> FindByTokenAsync(string token, CancellationToken cancellationToken)
    {
        var hash = Hash(token);
        return await db.Invitations
            .Include(i => i.Organization)
            .Include(i => i.InvitedBy)
            .SingleOrDefaultAsync(i => i.TokenHash == hash, cancellationToken)
            ?? throw new NotFoundException("Invitation");
    }

    private static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
