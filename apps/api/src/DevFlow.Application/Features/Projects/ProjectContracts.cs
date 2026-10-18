using DevFlow.Application.Common;
using FluentValidation;

namespace DevFlow.Application.Features.Projects;

public sealed record ProjectResponse(
    Guid Id,
    Guid OrganizationId,
    string Name,
    string Key,
    string? Description,
    UserSummary? Lead,
    int OpenTaskCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ArchivedAt);

public sealed record CreateProjectRequest(string Name, string Key, string? Description, Guid? LeadId);

/// <summary>Partial update: only non-null fields change. Set ClearLead to remove the lead.</summary>
public sealed record UpdateProjectRequest(string? Name, string? Description, Guid? LeadId, bool ClearLead = false);

public sealed class CreateProjectRequestValidator : AbstractValidator<CreateProjectRequest>
{
    public CreateProjectRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Key).NotEmpty()
            .Matches("^[A-Z][A-Z0-9]{1,9}$").WithMessage("Use 2–10 uppercase letters or digits, starting with a letter.");
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public sealed class UpdateProjectRequestValidator : AbstractValidator<UpdateProjectRequest>
{
    public UpdateProjectRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80).When(x => x.Name is not null);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}
