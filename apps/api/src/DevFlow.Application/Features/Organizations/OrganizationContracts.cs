using DevFlow.Application.Common;
using DevFlow.Domain.Organizations;
using FluentValidation;

namespace DevFlow.Application.Features.Organizations;

public sealed record OrganizationResponse(Guid Id, string Name, OrganizationRole Role, int MemberCount, DateTimeOffset CreatedAt);

public sealed record CreateOrganizationRequest(string Name);

public sealed record UpdateOrganizationRequest(string Name);

public sealed record MemberResponse(Guid UserId, string DisplayName, string Email, OrganizationRole Role, DateTimeOffset JoinedAt);

public sealed record ChangeMemberRoleRequest(OrganizationRole Role);

public sealed record InvitationResponse(
    Guid Id,
    string Email,
    OrganizationRole Role,
    UserSummary InvitedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt);

public sealed record CreateInvitationRequest(string Email, OrganizationRole Role);

/// <summary>What an invitee sees before accepting. Deliberately minimal: the link is the only credential.</summary>
public sealed record InvitationPreviewResponse(
    string OrganizationName,
    string InvitedByName,
    string Email,
    OrganizationRole Role,
    InvitationStatus Status,
    DateTimeOffset ExpiresAt);

public sealed record AcceptInvitationResponse(Guid OrganizationId, string OrganizationName);

public sealed class CreateOrganizationRequestValidator : AbstractValidator<CreateOrganizationRequest>
{
    public CreateOrganizationRequestValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
}

public sealed class UpdateOrganizationRequestValidator : AbstractValidator<UpdateOrganizationRequest>
{
    public UpdateOrganizationRequestValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
}

public sealed class ChangeMemberRoleRequestValidator : AbstractValidator<ChangeMemberRoleRequest>
{
    public ChangeMemberRoleRequestValidator() => RuleFor(x => x.Role).IsInEnum();
}

public sealed class CreateInvitationRequestValidator : AbstractValidator<CreateInvitationRequest>
{
    public CreateInvitationRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Role).IsInEnum()
            .NotEqual(OrganizationRole.Owner).WithMessage("Invite as a member or admin; promote to owner after they join.");
    }
}
