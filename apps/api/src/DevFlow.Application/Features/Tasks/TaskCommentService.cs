using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Tasks;

/// <summary>Comments and history on a task. Authors edit their own comments; admins can delete any.</summary>
public sealed class TaskCommentService(
    IAppDbContext db,
    ICurrentUser currentUser,
    OrganizationAccess access,
    TaskService tasks,
    NotificationService notifications,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<CommentResponse>> ListAsync(Guid taskId, CancellationToken cancellationToken)
    {
        await tasks.RequireTaskAsync(taskId, cancellationToken);
        return await db.TaskComments
            .Where(c => c.TaskId == taskId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentResponse(c.Id, c.TaskId, new UserSummary(c.Author.Id, c.Author.DisplayName, c.Author.Email!), c.Body, c.CreatedAt, c.EditedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<CommentResponse> AddAsync(Guid taskId, CommentRequest request, CancellationToken cancellationToken)
    {
        var task = await tasks.RequireTaskAsync(taskId, cancellationToken);
        if (task.Project.IsArchived) throw new ConflictException("This project is archived. Restore it to comment on its tasks.");

        var comment = new TaskComment
        {
            OrganizationId = task.OrganizationId,
            TaskId = task.Id,
            AuthorId = currentUser.Id,
            Body = request.Body.Trim(),
            CreatedAt = clock.GetUtcNow(),
        };
        db.TaskComments.Add(comment);
        tasks.Record(task, "commented");
        task.UpdatedAt = comment.CreatedAt;
        await notifications.TaskCommentedAsync(task, task.Project.Key, comment.Body, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        return await ProjectAsync(comment.Id, cancellationToken);
    }

    public async Task<CommentResponse> EditAsync(Guid commentId, CommentRequest request, CancellationToken cancellationToken)
    {
        var comment = await FindAsync(commentId, cancellationToken);
        if (comment.AuthorId != currentUser.Id) throw new ForbiddenException("You can only edit your own comments.");

        comment.Body = request.Body.Trim();
        comment.EditedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return await ProjectAsync(commentId, cancellationToken);
    }

    public async Task DeleteAsync(Guid commentId, CancellationToken cancellationToken)
    {
        var comment = await FindAsync(commentId, cancellationToken);
        if (comment.AuthorId != currentUser.Id)
        {
            await access.RequireAsync(comment.OrganizationId, OrganizationRole.Admin, cancellationToken);
        }
        db.TaskComments.Remove(comment);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ActivityResponse>> ActivityAsync(Guid taskId, CancellationToken cancellationToken)
    {
        await tasks.RequireTaskAsync(taskId, cancellationToken);
        var entries = await db.TaskActivities
            .Where(a => a.TaskId == taskId)
            .OrderByDescending(a => a.CreatedAt)
            .Take(200)
            .Select(a => new { a.Id, Actor = new UserSummary(a.Actor.Id, a.Actor.DisplayName, a.Actor.Email!), a.Type, a.Data, a.CreatedAt })
            .ToListAsync(cancellationToken);
        return entries.Select(a => new ActivityResponse(a.Id, a.Actor, a.Type, a.Data, a.CreatedAt)).ToList();
    }

    private async Task<TaskComment> FindAsync(Guid commentId, CancellationToken cancellationToken)
    {
        var comment = await db.TaskComments.SingleOrDefaultAsync(c => c.Id == commentId, cancellationToken)
            ?? throw new NotFoundException("Comment");
        await tasks.RequireTaskAsync(comment.TaskId, cancellationToken);
        return comment;
    }

    private Task<CommentResponse> ProjectAsync(Guid commentId, CancellationToken cancellationToken) =>
        db.TaskComments.Where(c => c.Id == commentId)
            .Select(c => new CommentResponse(c.Id, c.TaskId, new UserSummary(c.Author.Id, c.Author.DisplayName, c.Author.Email!), c.Body, c.CreatedAt, c.EditedAt))
            .SingleAsync(cancellationToken);
}
