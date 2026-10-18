using DevFlow.Application.Features.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
public sealed class ProjectsController(ProjectService projects) : ControllerBase
{
    [HttpGet("api/v1/organizations/{organizationId:guid}/projects")]
    public Task<IReadOnlyList<ProjectResponse>> List(Guid organizationId, [FromQuery] bool includeArchived, CancellationToken ct) =>
        projects.ListAsync(organizationId, includeArchived, ct);

    [HttpPost("api/v1/organizations/{organizationId:guid}/projects")]
    public async Task<ActionResult<ProjectResponse>> Create(Guid organizationId, CreateProjectRequest request, CancellationToken ct)
    {
        var project = await projects.CreateAsync(organizationId, request, ct);
        return CreatedAtAction(nameof(Get), new { projectId = project.Id }, project);
    }

    [HttpGet("api/v1/projects/{projectId:guid}")]
    public Task<ProjectResponse> Get(Guid projectId, CancellationToken ct) => projects.GetAsync(projectId, ct);

    [HttpPatch("api/v1/projects/{projectId:guid}")]
    public Task<ProjectResponse> Update(Guid projectId, UpdateProjectRequest request, CancellationToken ct) =>
        projects.UpdateAsync(projectId, request, ct);

    [HttpPost("api/v1/projects/{projectId:guid}/archive")]
    public Task<ProjectResponse> Archive(Guid projectId, CancellationToken ct) => projects.SetArchivedAsync(projectId, true, ct);

    [HttpPost("api/v1/projects/{projectId:guid}/restore")]
    public Task<ProjectResponse> Restore(Guid projectId, CancellationToken ct) => projects.SetArchivedAsync(projectId, false, ct);
}
