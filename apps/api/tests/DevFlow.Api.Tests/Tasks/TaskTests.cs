using System.Net;
using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Projects;
using DevFlow.Application.Features.Tasks;
using DevFlow.Domain.Common;
using DevFlow.Domain.Tasks;

namespace DevFlow.Api.Tests.Tasks;

[Collection(ApiCollection.Name)]
public sealed class TaskTests(DevFlowApiFactory factory)
{
    private sealed record Setup(Scenario.Actor Owner, OrganizationResponse Organization, ProjectResponse Project) : IDisposable
    {
        public void Dispose() => Owner.Dispose();
    }

    private async Task<Setup> SetupAsync(string key = "WEB")
    {
        var owner = await Scenario.UserAsync(factory, "owner");
        var organization = await Scenario.OrganizationAsync(owner);
        var project = await Scenario.ProjectAsync(owner, organization.Id, key);
        return new Setup(owner, organization, project);
    }

    private static Task<TaskDetail> CreateAsync(TestApiClient client, Guid projectId, string title,
        TaskItemStatus? status = null, Priority? priority = null, Guid? assigneeId = null) =>
        client.PostJsonAsync<TaskDetail>($"/api/v1/projects/{projectId}/tasks",
            new CreateTaskRequest(title, null, status, priority, assigneeId, null));

    [Fact]
    public async Task Tasks_get_sequential_keys_per_project()
    {
        using var s = await SetupAsync("API");

        var first = await CreateAsync(s.Owner.Client, s.Project.Id, "First");
        var second = await CreateAsync(s.Owner.Client, s.Project.Id, "Second");

        Assert.Equal("API-1", first.Key);
        Assert.Equal("API-2", second.Key);
        Assert.Equal(TaskItemStatus.Todo, first.Status);
        Assert.Equal(s.Owner.User.Id, first.Reporter.Id);
    }

    [Fact]
    public async Task Concurrent_creation_never_reuses_a_number()
    {
        using var s = await SetupAsync();

        var created = await Task.WhenAll(Enumerable.Range(1, 20)
            .Select(i => CreateAsync(s.Owner.Client, s.Project.Id, $"Parallel {i}")));

        Assert.Equal(Enumerable.Range(1, 20), created.Select(t => t.Number).Order());
    }

    [Fact]
    public async Task Moving_a_task_reorders_the_board_and_records_history()
    {
        using var s = await SetupAsync();
        var a = await CreateAsync(s.Owner.Client, s.Project.Id, "A");
        var b = await CreateAsync(s.Owner.Client, s.Project.Id, "B");
        var c = await CreateAsync(s.Owner.Client, s.Project.Id, "C", TaskItemStatus.InProgress);

        // Drop C into To do, between A and B.
        await s.Owner.Client.PostJsonAsync<TaskSummary>($"/api/v1/tasks/{c.Id}/move",
            new MoveTaskRequest(TaskItemStatus.Todo, a.Id, b.Id));

        var board = await s.Owner.Client.GetJsonAsync<BoardResponse>($"/api/v1/projects/{s.Project.Id}/board");
        var todo = board.Columns.Single(col => col.Status == TaskItemStatus.Todo).Tasks.Select(t => t.Title);
        Assert.Equal(["A", "C", "B"], todo);
        Assert.Empty(board.Columns.Single(col => col.Status == TaskItemStatus.InProgress).Tasks);

        var activity = await s.Owner.Client.GetJsonAsync<List<ActivityResponse>>($"/api/v1/tasks/{c.Id}/activity");
        var moved = Assert.Single(activity, e => e.Type == "status_changed");
        Assert.Equal("InProgress", moved.Data["from"]);
        Assert.Equal("Todo", moved.Data["to"]);
    }

    [Fact]
    public async Task Repeated_moves_into_the_same_gap_keep_a_correct_order()
    {
        using var s = await SetupAsync();
        var first = await CreateAsync(s.Owner.Client, s.Project.Id, "first");
        var last = await CreateAsync(s.Owner.Client, s.Project.Id, "last");
        var inserted = new List<TaskDetail>();

        // Each insert lands right after "first", halving the gap; after ~30 halvings the column
        // must be renumbered for the next insert to fit.
        for (var i = 0; i < 40; i++)
        {
            var task = await CreateAsync(s.Owner.Client, s.Project.Id, $"n{i}");
            await s.Owner.Client.PostJsonAsync<TaskSummary>($"/api/v1/tasks/{task.Id}/move",
                new MoveTaskRequest(TaskItemStatus.Todo, first.Id, inserted.Count > 0 ? inserted[^1].Id : last.Id));
            inserted.Add(task);
        }

        var board = await s.Owner.Client.GetJsonAsync<BoardResponse>($"/api/v1/projects/{s.Project.Id}/board");
        var titles = board.Columns.Single(col => col.Status == TaskItemStatus.Todo).Tasks.Select(t => t.Title).ToList();
        string[] expected = ["first", .. Enumerable.Range(0, 40).Reverse().Select(i => $"n{i}"), "last"];
        Assert.Equal(expected, titles);
    }

    [Fact]
    public async Task List_supports_filters_search_and_pagination()
    {
        using var s = await SetupAsync("FLT");
        await CreateAsync(s.Owner.Client, s.Project.Id, "Fix login redirect", priority: Priority.High);
        await CreateAsync(s.Owner.Client, s.Project.Id, "Write release notes", TaskItemStatus.Done, Priority.Low);
        await CreateAsync(s.Owner.Client, s.Project.Id, "Login rate limiting", TaskItemStatus.InProgress, Priority.Urgent, s.Owner.User.Id);
        var basePath = $"/api/v1/projects/{s.Project.Id}/tasks";

        var search = await s.Owner.Client.GetJsonAsync<PagedResult<TaskSummary>>($"{basePath}?search=LOGIN");
        Assert.Equal(2, search.TotalCount);

        var byKey = await s.Owner.Client.GetJsonAsync<PagedResult<TaskSummary>>($"{basePath}?search=flt-2");
        Assert.Equal("Write release notes", Assert.Single(byKey.Items).Title);

        var filtered = await s.Owner.Client.GetJsonAsync<PagedResult<TaskSummary>>($"{basePath}?status=Todo&status=InProgress&priority=Urgent");
        Assert.Equal("Login rate limiting", Assert.Single(filtered.Items).Title);

        var mine = await s.Owner.Client.GetJsonAsync<PagedResult<TaskSummary>>($"{basePath}?assigneeId={s.Owner.User.Id}");
        Assert.Single(mine.Items);

        var page = await s.Owner.Client.GetJsonAsync<PagedResult<TaskSummary>>($"{basePath}?pageSize=2&page=2&sort=Oldest");
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, page.TotalPages);
        Assert.Equal("Login rate limiting", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task Assigning_notifies_the_assignee_and_requires_membership()
    {
        using var s = await SetupAsync();
        using var bob = await Scenario.UserAsync(factory, "bob");
        using var outsider = await Scenario.UserAsync(factory, "outsider");
        await Scenario.JoinAsync(s.Owner, s.Organization.Id, bob);
        var task = await CreateAsync(s.Owner.Client, s.Project.Id, "Needs an owner");

        using var invalid = await s.Owner.Client.PatchAsync($"/api/v1/tasks/{task.Id}", new UpdateTaskRequest(AssigneeId: outsider.User.Id));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, invalid);

        var updated = await s.Owner.Client.PatchJsonAsync<TaskDetail>($"/api/v1/tasks/{task.Id}", new UpdateTaskRequest(AssigneeId: bob.User.Id));
        Assert.Equal(bob.User.Id, updated.Assignee!.Id);

        var unread = await bob.Client.GetJsonAsync<UnreadCountResponse>("/api/v1/notifications/unread-count");
        Assert.Equal(1, unread.Count);
        var inbox = await bob.Client.GetJsonAsync<PagedResult<NotificationResponse>>("/api/v1/notifications");
        var notification = Assert.Single(inbox.Items);
        Assert.Equal("task.assigned", notification.Type);
        Assert.Contains("WEB-1", notification.Title);

        var mine = await bob.Client.GetJsonAsync<PagedResult<TaskSummary>>($"/api/v1/organizations/{s.Organization.Id}/my-tasks");
        Assert.Equal(task.Id, Assert.Single(mine.Items).Id);

        await bob.Client.PostAsync("/api/v1/notifications/read-all");
        Assert.Equal(0, (await bob.Client.GetJsonAsync<UnreadCountResponse>("/api/v1/notifications/unread-count")).Count);
    }

    [Fact]
    public async Task Comments_follow_author_and_admin_rules()
    {
        using var s = await SetupAsync();
        using var bob = await Scenario.UserAsync(factory, "bob");
        await Scenario.JoinAsync(s.Owner, s.Organization.Id, bob);
        var task = await CreateAsync(s.Owner.Client, s.Project.Id, "Discuss me");

        var comment = await bob.Client.PostJsonAsync<CommentResponse>($"/api/v1/tasks/{task.Id}/comments", new CommentRequest("Looks good to me"));
        Assert.Equal(bob.User.Id, comment.Author.Id);

        // The reporter (owner) is notified about the comment.
        Assert.Equal(1, (await s.Owner.Client.GetJsonAsync<UnreadCountResponse>("/api/v1/notifications/unread-count")).Count);

        using var foreignEdit = await s.Owner.Client.PatchAsync($"/api/v1/task-comments/{comment.Id}", new CommentRequest("Edited by someone else"));
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, foreignEdit);

        var edited = await bob.Client.PatchJsonAsync<CommentResponse>($"/api/v1/task-comments/{comment.Id}", new CommentRequest("Looks great"));
        Assert.NotNull(edited.EditedAt);

        using var adminDelete = await s.Owner.Client.DeleteAsync($"/api/v1/task-comments/{comment.Id}");
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, adminDelete);
        Assert.Empty(await bob.Client.GetJsonAsync<List<CommentResponse>>($"/api/v1/tasks/{task.Id}/comments"));
    }

    [Fact]
    public async Task Outsiders_cannot_read_or_change_tasks()
    {
        using var s = await SetupAsync();
        using var mallory = await Scenario.UserAsync(factory, "mallory");
        var task = await CreateAsync(s.Owner.Client, s.Project.Id, "Private");

        using var read = await mallory.Client.GetAsync($"/api/v1/tasks/{task.Id}");
        using var board = await mallory.Client.GetAsync($"/api/v1/projects/{s.Project.Id}/board");
        using var move = await mallory.Client.PostAsync($"/api/v1/tasks/{task.Id}/move", new MoveTaskRequest(TaskItemStatus.Done, null, null));
        using var comment = await mallory.Client.PostAsync($"/api/v1/tasks/{task.Id}/comments", new CommentRequest("hi"));

        foreach (var response in new[] { read, board, move, comment })
        {
            await HttpAssert.StatusAsync(HttpStatusCode.NotFound, response);
        }
    }

    [Fact]
    public async Task Archived_tasks_leave_the_board_and_archived_projects_are_read_only()
    {
        using var s = await SetupAsync();
        var task = await CreateAsync(s.Owner.Client, s.Project.Id, "Old idea");

        await s.Owner.Client.PostJsonAsync<TaskDetail>($"/api/v1/tasks/{task.Id}/archive");
        var board = await s.Owner.Client.GetJsonAsync<BoardResponse>($"/api/v1/projects/{s.Project.Id}/board");
        Assert.All(board.Columns, column => Assert.Empty(column.Tasks));
        var archived = await s.Owner.Client.GetJsonAsync<PagedResult<TaskSummary>>($"/api/v1/projects/{s.Project.Id}/tasks?archived=true");
        Assert.Single(archived.Items);

        await s.Owner.Client.PostJsonAsync<ProjectResponse>($"/api/v1/projects/{s.Project.Id}/archive");
        using var create = await s.Owner.Client.PostAsync($"/api/v1/projects/{s.Project.Id}/tasks",
            new CreateTaskRequest("Too late", null, null, null, null, null));
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, create);
    }

    [Fact]
    public async Task Project_open_task_count_excludes_done_and_archived()
    {
        using var s = await SetupAsync();
        await CreateAsync(s.Owner.Client, s.Project.Id, "Open");
        await CreateAsync(s.Owner.Client, s.Project.Id, "Done", TaskItemStatus.Done);
        var archived = await CreateAsync(s.Owner.Client, s.Project.Id, "Archived");
        await s.Owner.Client.PostJsonAsync<TaskDetail>($"/api/v1/tasks/{archived.Id}/archive");

        var project = await s.Owner.Client.GetJsonAsync<ProjectResponse>($"/api/v1/projects/{s.Project.Id}");
        Assert.Equal(1, project.OpenTaskCount);
    }
}
