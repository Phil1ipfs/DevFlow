using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Projects;
using DevFlow.Domain.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Projects;

/// <summary>Every member can see projects; admins create, edit and archive them.</summary>
public sealed class ProjectService(
    IAppDbContext db,
    ICurrentUser currentUser,
    OrganizationAccess access,
    AuditTrail audit,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<ProjectResponse>> ListAsync(Guid organizationId, bool includeArchived, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        var query = db.Projects.Where(p => p.OrganizationId == organizationId);
        if (!includeArchived) query = query.Where(p => p.ArchivedAt == null);
        return await Project(query.OrderBy(p => p.ArchivedAt != null).ThenBy(p => p.Name)).ToListAsync(cancellationToken);
    }

    public async Task<ProjectResponse> GetAsync(Guid projectId, CancellationToken cancellationToken)
    {
        await RequireProjectAccessAsync(projectId, OrganizationRole.Member, cancellationToken);
        return await Project(db.Projects.Where(p => p.Id == projectId)).SingleAsync(cancellationToken);
    }

    public async Task<ProjectResponse> CreateAsync(Guid organizationId, CreateProjectRequest request, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, OrganizationRole.Admin, cancellationToken);
        var key = request.Key.Trim().ToUpperInvariant();
        if (await db.Projects.AnyAsync(p => p.OrganizationId == organizationId && p.Key == key, cancellationToken))
        {
            throw new AppValidationException("key", $"Another project already uses the key {key}.");
        }
        if (request.LeadId is { } leadId) await EnsureMemberAsync(organizationId, leadId, cancellationToken);

        var project = new Project
        {
            OrganizationId = organizationId,
            Name = request.Name.Trim(),
            Key = key,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            LeadId = request.LeadId,
            CreatedAt = clock.GetUtcNow(),
            CreatedById = currentUser.Id,
        };
        db.Projects.Add(project);
        audit.Record(organizationId, "project.created", "project", project.Id, $"Created project {key} \"{project.Name}\"");
        await db.SaveChangesAsync(cancellationToken);

        return await GetAsync(project.Id, cancellationToken);
    }

    public async Task<ProjectResponse> UpdateAsync(Guid projectId, UpdateProjectRequest request, CancellationToken cancellationToken)
    {
        var project = await RequireProjectAccessAsync(projectId, OrganizationRole.Admin, cancellationToken);

        if (request.Name is not null) project.Name = request.Name.Trim();
        if (request.Description is not null)
        {
            project.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        }
        if (request.ClearLead)
        {
            project.LeadId = null;
        }
        else if (request.LeadId is { } leadId)
        {
            await EnsureMemberAsync(project.OrganizationId, leadId, cancellationToken);
            project.LeadId = leadId;
        }

        audit.Record(project.OrganizationId, "project.updated", "project", project.Id, $"Updated project {project.Key}");
        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(projectId, cancellationToken);
    }

    public async Task<ProjectResponse> SetArchivedAsync(Guid projectId, bool archived, CancellationToken cancellationToken)
    {
        var project = await RequireProjectAccessAsync(projectId, OrganizationRole.Admin, cancellationToken);
        if (archived) project.Archive(clock.GetUtcNow());
        else project.Restore();

        audit.Record(project.OrganizationId, archived ? "project.archived" : "project.restored", "project", project.Id,
            $"{(archived ? "Archived" : "Restored")} project {project.Key}");
        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(projectId, cancellationToken);
    }

    /// <summary>Loads a project and checks the caller's role in its organization (404 if not a member).</summary>
    public async Task<Project> RequireProjectAccessAsync(Guid projectId, OrganizationRole minimumRole, CancellationToken cancellationToken)
    {
        var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == projectId, cancellationToken)
            ?? throw new NotFoundException("Project");
        try
        {
            await access.RequireAsync(project.OrganizationId, minimumRole, cancellationToken);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Project");
        }
        return project;
    }

    private async Task EnsureMemberAsync(Guid organizationId, Guid userId, CancellationToken cancellationToken)
    {
        if (!await db.Memberships.AnyAsync(m => m.OrganizationId == organizationId && m.UserId == userId, cancellationToken))
        {
            throw new AppValidationException("leadId", "The project lead must be a member of this organization.");
        }
    }

    private IQueryable<ProjectResponse> Project(IQueryable<Project> query) =>
        query.Select(p => new ProjectResponse(
            p.Id,
            p.OrganizationId,
            p.Name,
            p.Key,
            p.Description,
            p.Lead == null ? null : new UserSummary(p.Lead.Id, p.Lead.DisplayName, p.Lead.Email!),
            db.Tasks.Count(t => t.ProjectId == p.Id && t.ArchivedAt == null && t.Status != TaskItemStatus.Done),
            p.CreatedAt,
            p.ArchivedAt));
}
