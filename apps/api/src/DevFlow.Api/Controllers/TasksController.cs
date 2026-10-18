using DevFlow.Application.Common;
using DevFlow.Application.Features.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TasksController(TaskService tasks, TaskCommentService comments) : ControllerBase
{
    /// <summary>Filterable, paginated task list, e.g. ?status=Todo&amp;status=InProgress&amp;search=login&amp;page=2.</summary>
    [HttpGet("api/v1/projects/{projectId:guid}/tasks")]
    public Task<PagedResult<TaskSummary>> List(Guid projectId, [FromQuery] TaskListQuery query, CancellationToken ct) =>
        tasks.ListAsync(projectId, query, ct);

    [HttpGet("api/v1/projects/{projectId:guid}/board")]
    public Task<BoardResponse> Board(Guid projectId, [FromQuery] TaskListQuery query, CancellationToken ct) =>
        tasks.BoardAsync(projectId, query, ct);

    [HttpPost("api/v1/projects/{projectId:guid}/tasks")]
    public async Task<ActionResult<TaskDetail>> Create(Guid projectId, CreateTaskRequest request, CancellationToken ct)
    {
        var task = await tasks.CreateAsync(projectId, request, ct);
        return CreatedAtAction(nameof(Get), new { taskId = task.Id }, task);
    }

    [HttpGet("api/v1/organizations/{organizationId:guid}/my-tasks")]
    public Task<PagedResult<TaskSummary>> MyTasks(Guid organizationId, [FromQuery] TaskListQuery query, CancellationToken ct) =>
        tasks.MyTasksAsync(organizationId, query, ct);

    [HttpGet("api/v1/tasks/{taskId:guid}")]
    public Task<TaskDetail> Get(Guid taskId, CancellationToken ct) => tasks.GetAsync(taskId, ct);

    [HttpPatch("api/v1/tasks/{taskId:guid}")]
    public Task<TaskDetail> Update(Guid taskId, UpdateTaskRequest request, CancellationToken ct) => tasks.UpdateAsync(taskId, request, ct);

    [HttpPost("api/v1/tasks/{taskId:guid}/move")]
    public Task<TaskSummary> Move(Guid taskId, MoveTaskRequest request, CancellationToken ct) => tasks.MoveAsync(taskId, request, ct);

    [HttpPost("api/v1/tasks/{taskId:guid}/archive")]
    public Task<TaskDetail> Archive(Guid taskId, CancellationToken ct) => tasks.SetArchivedAsync(taskId, true, ct);

    [HttpPost("api/v1/tasks/{taskId:guid}/restore")]
    public Task<TaskDetail> Restore(Guid taskId, CancellationToken ct) => tasks.SetArchivedAsync(taskId, false, ct);

    // ---- Comments and history ----

    [HttpGet("api/v1/tasks/{taskId:guid}/comments")]
    public Task<IReadOnlyList<CommentResponse>> Comments(Guid taskId, CancellationToken ct) => comments.ListAsync(taskId, ct);

    [HttpPost("api/v1/tasks/{taskId:guid}/comments")]
    public async Task<ActionResult<CommentResponse>> AddComment(Guid taskId, CommentRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await comments.AddAsync(taskId, request, ct));

    [HttpPatch("api/v1/task-comments/{commentId:guid}")]
    public Task<CommentResponse> EditComment(Guid commentId, CommentRequest request, CancellationToken ct) =>
        comments.EditAsync(commentId, request, ct);

    [HttpDelete("api/v1/task-comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid commentId, CancellationToken ct)
    {
        await comments.DeleteAsync(commentId, ct);
        return NoContent();
    }

    [HttpGet("api/v1/tasks/{taskId:guid}/activity")]
    public Task<IReadOnlyList<ActivityResponse>> Activity(Guid taskId, CancellationToken ct) => comments.ActivityAsync(taskId, ct);
}
