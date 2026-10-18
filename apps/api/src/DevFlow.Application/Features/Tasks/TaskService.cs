using System.Text.RegularExpressions;
using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using DevFlow.Application.Features.Projects;
using DevFlow.Domain.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Tasks;

/// <summary>
/// Task use cases. Every member of an organization can create, edit, move and archive tasks in
/// its active projects; archived projects are read-only.
/// </summary>
public sealed partial class TaskService(
    IAppDbContext db,
    ICurrentUser currentUser,
    OrganizationAccess access,
    ProjectService projects,
    NotificationService notifications,
    ISequenceAllocator sequences,
    TimeProvider clock)
{
    private const double PositionGap = 1024;
    private const double MinimumPositionGap = 1e-6;
    private const int BoardColumnLimit = 500;

    // ---------------------------------------------------------------- queries

    public async Task<PagedResult<TaskSummary>> ListAsync(Guid projectId, TaskListQuery query, CancellationToken cancellationToken)
    {
        await projects.RequireProjectAccessAsync(projectId, OrganizationRole.Member, cancellationToken);
        var tasks = Filter(db.Tasks.Where(t => t.ProjectId == projectId), query);
        return await Summaries(Sort(tasks, query.Sort)).ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);
    }

    /// <summary>Tasks assigned to the current user across all projects of an organization.</summary>
    public async Task<PagedResult<TaskSummary>> MyTasksAsync(Guid organizationId, TaskListQuery query, CancellationToken cancellationToken)
    {
        await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        var tasks = Filter(
            db.Tasks.Where(t => t.OrganizationId == organizationId && t.AssigneeId == currentUser.Id && t.Project.ArchivedAt == null),
            query with { AssigneeId = null, Unassigned = false });
        var sort = query.Sort == TaskSort.Newest ? TaskSort.DueDate : query.Sort;
        return await Summaries(Sort(tasks, sort)).ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);
    }

    public async Task<BoardResponse> BoardAsync(Guid projectId, TaskListQuery query, CancellationToken cancellationToken)
    {
        await projects.RequireProjectAccessAsync(projectId, OrganizationRole.Member, cancellationToken);
        var tasks = Filter(db.Tasks.Where(t => t.ProjectId == projectId), query with { Status = null, Archived = false });
        var cards = await Summaries(tasks.OrderBy(t => t.Position).ThenBy(t => t.Number)).ToListAsync(cancellationToken);

        var columns = Enum.GetValues<TaskItemStatus>()
            .Select(status => new BoardColumn(status, cards.Where(c => c.Status == status).Take(BoardColumnLimit).ToList()))
            .ToList();
        return new BoardResponse(projectId, columns);
    }

    public async Task<TaskDetail> GetAsync(Guid taskId, CancellationToken cancellationToken)
    {
        await RequireTaskAsync(taskId, cancellationToken);
        return await Details(db.Tasks.Where(t => t.Id == taskId)).SingleAsync(cancellationToken);
    }

    // ---------------------------------------------------------------- commands

    public async Task<TaskDetail> CreateAsync(Guid projectId, CreateTaskRequest request, CancellationToken cancellationToken)
    {
        var project = await projects.RequireProjectAccessAsync(projectId, OrganizationRole.Member, cancellationToken);
        EnsureWritable(project.IsArchived);
        if (request.AssigneeId is { } assigneeId) await EnsureMemberAsync(project.OrganizationId, assigneeId, cancellationToken);

        var status = request.Status ?? TaskItemStatus.Todo;
        var now = clock.GetUtcNow();
        var task = new TaskItem
        {
            OrganizationId = project.OrganizationId,
            ProjectId = project.Id,
            Number = await sequences.NextTaskNumberAsync(project.Id, cancellationToken),
            Title = request.Title.Trim(),
            Description = Normalize(request.Description),
            Priority = request.Priority ?? Priority.None,
            AssigneeId = request.AssigneeId,
            ReporterId = currentUser.Id,
            DueDate = request.DueDate,
            Position = await EndOfColumnAsync(project.Id, status, cancellationToken),
            CreatedAt = now,
            UpdatedAt = now,
        };
        task.ChangeStatus(status, now);
        db.Tasks.Add(task);
        Record(task, "created");
        if (task.AssigneeId is { } assigned && assigned != currentUser.Id)
        {
            await notifications.TaskAssignedAsync(task, project.Key, assigned, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        return await GetAsync(task.Id, cancellationToken);
    }

    public async Task<TaskDetail> UpdateAsync(Guid taskId, UpdateTaskRequest request, CancellationToken cancellationToken)
    {
        var task = await RequireTaskAsync(taskId, cancellationToken);
        EnsureWritable(task.Project.IsArchived);
        var now = clock.GetUtcNow();

        if (request.Title is { } title && title.Trim() != task.Title)
        {
            Record(task, "title_changed", ("from", task.Title), ("to", title.Trim()));
            task.Title = title.Trim();
        }
        if (request.Description is not null && Normalize(request.Description) != task.Description)
        {
            task.Description = Normalize(request.Description);
            Record(task, "description_changed");
        }
        if (request.Priority is { } priority && priority != task.Priority)
        {
            Record(task, "priority_changed", ("from", task.Priority.ToString()), ("to", priority.ToString()));
            task.Priority = priority;
        }
        if (request.ClearDueDate && task.DueDate is not null)
        {
            Record(task, "due_date_changed", ("from", task.DueDate.Value.ToString("O")), ("to", ""));
            task.DueDate = null;
        }
        else if (request.DueDate is { } dueDate && dueDate != task.DueDate)
        {
            Record(task, "due_date_changed", ("from", task.DueDate?.ToString("O") ?? ""), ("to", dueDate.ToString("O")));
            task.DueDate = dueDate;
            task.DueReminderSentAt = null;
        }
        await ApplyAssigneeAsync(task, request.ClearAssignee ? null : request.AssigneeId, request.ClearAssignee, cancellationToken);
        if (request.Status is { } status && status != task.Status)
        {
            Record(task, "status_changed", ("from", task.Status.ToString()), ("to", status.ToString()));
            task.ChangeStatus(status, now);
            task.Position = await EndOfColumnAsync(task.ProjectId, status, cancellationToken);
        }

        task.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        return await GetAsync(taskId, cancellationToken);
    }

    /// <summary>Drag-and-drop: places the task in a column between two neighbours.</summary>
    public async Task<TaskSummary> MoveAsync(Guid taskId, MoveTaskRequest request, CancellationToken cancellationToken)
    {
        var task = await RequireTaskAsync(taskId, cancellationToken);
        EnsureWritable(task.Project.IsArchived);

        var position = await PositionBetweenAsync(task, request, cancellationToken);
        if (position is null)
        {
            // Neighbours are too close together after many moves: spread the column out again.
            await RenumberColumnAsync(task.ProjectId, request.Status, cancellationToken);
            position = await PositionBetweenAsync(task, request, cancellationToken)
                ?? throw new ConflictException("Could not place the task; refresh the board and try again.");
        }

        var now = clock.GetUtcNow();
        if (request.Status != task.Status)
        {
            Record(task, "status_changed", ("from", task.Status.ToString()), ("to", request.Status.ToString()));
            task.ChangeStatus(request.Status, now);
        }
        task.Position = position.Value;
        task.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        return await Summaries(db.Tasks.Where(t => t.Id == taskId)).SingleAsync(cancellationToken);
    }

    public async Task<TaskDetail> SetArchivedAsync(Guid taskId, bool archived, CancellationToken cancellationToken)
    {
        var task = await RequireTaskAsync(taskId, cancellationToken);
        EnsureWritable(task.Project.IsArchived);
        if (archived == task.IsArchived) return await GetAsync(taskId, cancellationToken);

        if (archived) task.Archive(clock.GetUtcNow());
        else task.Restore();
        Record(task, archived ? "archived" : "restored");
        task.UpdatedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(taskId, cancellationToken);
    }

    // ---------------------------------------------------------------- shared helpers

    /// <summary>Loads a task (with its project) and checks membership; 404 for outsiders.</summary>
    public async Task<TaskItem> RequireTaskAsync(Guid taskId, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.Include(t => t.Project).SingleOrDefaultAsync(t => t.Id == taskId, cancellationToken)
            ?? throw new NotFoundException("Task");
        try
        {
            await access.RequireAsync(task.OrganizationId, cancellationToken: cancellationToken);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Task");
        }
        return task;
    }

    public void Record(TaskItem task, string type, params (string Key, string Value)[] data) =>
        db.TaskActivities.Add(new TaskActivity
        {
            OrganizationId = task.OrganizationId,
            TaskId = task.Id,
            ActorId = currentUser.Id,
            Type = type,
            Data = data.ToDictionary(d => d.Key, d => d.Value),
            CreatedAt = clock.GetUtcNow(),
        });

    private async Task ApplyAssigneeAsync(TaskItem task, Guid? assigneeId, bool clear, CancellationToken cancellationToken)
    {
        if (clear && task.AssigneeId is not null)
        {
            Record(task, "unassigned");
            task.AssigneeId = null;
        }
        else if (assigneeId is { } newAssignee && newAssignee != task.AssigneeId)
        {
            var name = await EnsureMemberAsync(task.OrganizationId, newAssignee, cancellationToken);
            Record(task, "assigned", ("assigneeId", newAssignee.ToString()), ("assigneeName", name));
            task.AssigneeId = newAssignee;
            if (newAssignee != currentUser.Id) await notifications.TaskAssignedAsync(task, task.Project.Key, newAssignee, cancellationToken);
        }
    }

    private static void EnsureWritable(bool projectArchived)
    {
        if (projectArchived) throw new ConflictException("This project is archived. Restore it to change its tasks.");
    }

    private async Task<string> EnsureMemberAsync(Guid organizationId, Guid userId, CancellationToken cancellationToken) =>
        await db.Memberships
            .Where(m => m.OrganizationId == organizationId && m.UserId == userId)
            .Select(m => m.User.DisplayName)
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new AppValidationException("assigneeId", "The assignee must be a member of this organization.");

    private async Task<double> EndOfColumnAsync(Guid projectId, TaskItemStatus status, CancellationToken cancellationToken)
    {
        var last = await db.Tasks
            .Where(t => t.ProjectId == projectId && t.Status == status && t.ArchivedAt == null)
            .MaxAsync(t => (double?)t.Position, cancellationToken);
        return (last ?? 0) + PositionGap;
    }

    /// <summary>Returns null when the neighbours are too close to fit another position between them.</summary>
    private async Task<double?> PositionBetweenAsync(TaskItem task, MoveTaskRequest request, CancellationToken cancellationToken)
    {
        async Task<double?> NeighbourAsync(Guid? id)
        {
            if (id is null) return null;
            var neighbour = await db.Tasks.AsNoTracking()
                .Where(t => t.Id == id && t.ProjectId == task.ProjectId && t.Status == request.Status && t.ArchivedAt == null)
                .Select(t => (double?)t.Position)
                .SingleOrDefaultAsync(cancellationToken);
            return neighbour ?? throw new AppValidationException("position", "The neighbouring task is no longer in that column. Refresh the board.");
        }

        var before = await NeighbourAsync(request.BeforeTaskId);
        var after = await NeighbourAsync(request.AfterTaskId);

        return (before, after) switch
        {
            (null, null) => await EndOfColumnAsync(task.ProjectId, request.Status, cancellationToken),
            ({ } b, null) => b + PositionGap,
            (null, { } a) => a - PositionGap,
            ({ } b, { } a) when a - b > MinimumPositionGap => (b + a) / 2,
            _ => null,
        };
    }

    private async Task RenumberColumnAsync(Guid projectId, TaskItemStatus status, CancellationToken cancellationToken)
    {
        var column = await db.Tasks
            .Where(t => t.ProjectId == projectId && t.Status == status && t.ArchivedAt == null)
            .OrderBy(t => t.Position).ThenBy(t => t.Number)
            .ToListAsync(cancellationToken);
        for (var i = 0; i < column.Count; i++) column[i].Position = (i + 1) * PositionGap;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static string? Normalize(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    private static IQueryable<TaskItem> Filter(IQueryable<TaskItem> tasks, TaskListQuery query)
    {
        tasks = query.Archived ? tasks.Where(t => t.ArchivedAt != null) : tasks.Where(t => t.ArchivedAt == null);
        if (query.Status is { Length: > 0 } statuses) tasks = tasks.Where(t => statuses.Contains(t.Status));
        if (query.Priority is { Length: > 0 } priorities) tasks = tasks.Where(t => priorities.Contains(t.Priority));
        if (query.Unassigned) tasks = tasks.Where(t => t.AssigneeId == null);
        else if (query.AssigneeId is { } assigneeId) tasks = tasks.Where(t => t.AssigneeId == assigneeId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            var keyMatch = TaskKeyPattern().Match(search);
            if (keyMatch.Success)
            {
                var number = int.Parse(keyMatch.Groups["number"].Value);
                var key = keyMatch.Groups["key"].Value.ToUpperInvariant();
                tasks = tasks.Where(t => t.Number == number && (key == "" || t.Project.Key == key));
            }
            else
            {
                // EF Core translates this to a case-insensitive LIKE with wildcards escaped.
                var lowered = search.ToLowerInvariant();
                tasks = tasks.Where(t => t.Title.ToLower().Contains(lowered));
            }
        }
        return tasks;
    }

    private static IQueryable<TaskItem> Sort(IQueryable<TaskItem> tasks, TaskSort sort) => sort switch
    {
        TaskSort.Oldest => tasks.OrderBy(t => t.CreatedAt),
        TaskSort.RecentlyUpdated => tasks.OrderByDescending(t => t.UpdatedAt),
        TaskSort.Priority => tasks.OrderByDescending(t => t.Priority).ThenByDescending(t => t.CreatedAt),
        TaskSort.DueDate => tasks.OrderBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenByDescending(t => t.Priority),
        _ => tasks.OrderByDescending(t => t.CreatedAt),
    };

    // Projections: EF translates these to SQL that selects only the needed columns.
    private IQueryable<TaskSummary> Summaries(IQueryable<TaskItem> tasks) =>
        tasks.Select(t => new TaskSummary(
            t.Id,
            t.ProjectId,
            t.Project.Key + "-" + t.Number,
            t.Number,
            t.Title,
            t.Status,
            t.Priority,
            t.Assignee == null ? null : new UserSummary(t.Assignee.Id, t.Assignee.DisplayName, t.Assignee.Email!),
            t.DueDate,
            t.Position,
            db.TaskComments.Count(c => c.TaskId == t.Id),
            t.CreatedAt,
            t.UpdatedAt,
            t.ArchivedAt));

    private static IQueryable<TaskDetail> Details(IQueryable<TaskItem> tasks) =>
        tasks.Select(t => new TaskDetail(
            t.Id,
            t.OrganizationId,
            t.ProjectId,
            t.Project.Name,
            t.Project.Key + "-" + t.Number,
            t.Number,
            t.Title,
            t.Description,
            t.Status,
            t.Priority,
            t.Assignee == null ? null : new UserSummary(t.Assignee.Id, t.Assignee.DisplayName, t.Assignee.Email!),
            new UserSummary(t.Reporter.Id, t.Reporter.DisplayName, t.Reporter.Email!),
            t.DueDate,
            t.CreatedAt,
            t.UpdatedAt,
            t.CompletedAt,
            t.ArchivedAt));

    [GeneratedRegex(@"^(?:(?<key>[A-Za-z][A-Za-z0-9]{1,9})-)?(?<number>\d{1,9})$")]
    private static partial Regex TaskKeyPattern();
}
