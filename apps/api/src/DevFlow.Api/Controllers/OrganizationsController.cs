using DevFlow.Application.Features.Organizations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/organizations")]
public sealed class OrganizationsController(OrganizationService organizations, MemberService members, InvitationService invitations)
    : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<OrganizationResponse>> List(CancellationToken ct) => organizations.ListMineAsync(ct);

    [HttpPost]
    public async Task<ActionResult<OrganizationResponse>> Create(CreateOrganizationRequest request, CancellationToken ct)
    {
        var organization = await organizations.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { organizationId = organization.Id }, organization);
    }

    [HttpGet("{organizationId:guid}")]
    public Task<OrganizationResponse> Get(Guid organizationId, CancellationToken ct) => organizations.GetAsync(organizationId, ct);

    [HttpPatch("{organizationId:guid}")]
    public Task<OrganizationResponse> Update(Guid organizationId, UpdateOrganizationRequest request, CancellationToken ct) =>
        organizations.UpdateAsync(organizationId, request, ct);

    // ---- Members ----

    [HttpGet("{organizationId:guid}/members")]
    public Task<IReadOnlyList<MemberResponse>> Members(Guid organizationId, CancellationToken ct) => members.ListAsync(organizationId, ct);

    [HttpPatch("{organizationId:guid}/members/{userId:guid}")]
    public Task<MemberResponse> ChangeRole(Guid organizationId, Guid userId, ChangeMemberRoleRequest request, CancellationToken ct) =>
        members.ChangeRoleAsync(organizationId, userId, request.Role, ct);

    [HttpDelete("{organizationId:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid organizationId, Guid userId, CancellationToken ct)
    {
        await members.RemoveAsync(organizationId, userId, ct);
        return NoContent();
    }

    // ---- Invitations (admin side) ----

    [HttpGet("{organizationId:guid}/invitations")]
    public Task<IReadOnlyList<InvitationResponse>> Invitations(Guid organizationId, CancellationToken ct) =>
        invitations.ListPendingAsync(organizationId, ct);

    [HttpPost("{organizationId:guid}/invitations")]
    public async Task<ActionResult<InvitationResponse>> Invite(Guid organizationId, CreateInvitationRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await invitations.CreateAsync(organizationId, request, ct));

    [HttpDelete("{organizationId:guid}/invitations/{invitationId:guid}")]
    public async Task<IActionResult> RevokeInvitation(Guid organizationId, Guid invitationId, CancellationToken ct)
    {
        await invitations.RevokeAsync(organizationId, invitationId, ct);
        return NoContent();
    }
}

/// <summary>The invitee side of invitations, addressed by the secret token from the email link.</summary>
[ApiController]
[Route("api/v1/invitations/{token}")]
public sealed class InvitationsController(InvitationService invitations) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<InvitationPreviewResponse> Preview(string token, CancellationToken ct) => invitations.PreviewAsync(token, ct);

    [HttpPost("accept")]
    [Authorize]
    public Task<AcceptInvitationResponse> Accept(string token, CancellationToken ct) => invitations.AcceptAsync(token, ct);
}
