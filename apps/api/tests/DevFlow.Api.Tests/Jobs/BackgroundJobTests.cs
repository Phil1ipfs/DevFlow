using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tickets;
using DevFlow.Domain.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tickets;
using DevFlow.Infrastructure.BackgroundJobs;
using DevFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.Api.Tests.Jobs;

[Collection(ApiCollection.Name)]
public sealed class BackgroundJobTests(DevFlowApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<List<NotificationResponse>> InboxAsync(Scenario.Actor actor, string type) =>
        (await actor.Client.GetJsonAsync<PagedResult<NotificationResponse>>("/api/v1/notifications?pageSize=100"))
            .Items.Where(n => n.Type == type).ToList();

    [Fact]
    public async Task Due_date_reminder_is_sent_once_to_the_assignee()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        var organization = await Scenario.OrganizationAsync(owner);
        var project = await Scenario.ProjectAsync(owner, organization.Id);
        var today = DateOnly.FromDateTime(factory.Clock.GetUtcNow().UtcDateTime);
        await owner.Client.PostJsonAsync<TaskDetail>($"/api/v1/projects/{project.Id}/tasks",
            new CreateTaskRequest("Ship it", null, null, null, owner.User.Id, today));
        await owner.Client.PostJsonAsync<TaskDetail>($"/api/v1/projects/{project.Id}/tasks",
            new CreateTaskRequest("Later", null, null, null, owner.User.Id, today.AddDays(10)));

        await factory.Job<DueDateReminderJob>().RunOnceAsync(Ct);
        await factory.Job<DueDateReminderJob>().RunOnceAsync(Ct);

        var reminder = Assert.Single(await InboxAsync(owner, "task.due_soon"));
        Assert.Contains("WEB-1", reminder.Title);
        Assert.Null(reminder.Actor);
    }

    [Fact]
    public async Task Unassigned_urgent_tickets_escalate_to_admins_once()
    {
        using var admin = await Scenario.UserAsync(factory, "admin");
        using var requester = await Scenario.UserAsync(factory, "requester");
        var organization = await Scenario.OrganizationAsync(admin);
        await Scenario.JoinAsync(admin, organization.Id, requester);
        var ticket = await requester.Client.PostJsonAsync<TicketDetail>($"/api/v1/organizations/{organization.Id}/tickets",
            new CreateTicketRequest("Email is down", "Nobody can send mail.", Priority.Urgent, TicketCategory.Software));

        // Too early: nothing escalates.
        await factory.Job<TicketEscalationJob>().RunOnceAsync(Ct);
        Assert.Empty(await InboxAsync(admin, "ticket.escalated"));

        factory.Clock.Advance(TicketEscalationJob.UrgentThreshold + TimeSpan.FromMinutes(1));
        await factory.Job<TicketEscalationJob>().RunOnceAsync(Ct);
        await factory.Job<TicketEscalationJob>().RunOnceAsync(Ct);

        var escalation = Assert.Single(await InboxAsync(admin, "ticket.escalated"));
        Assert.Equal($"/app/tickets/{ticket.Id}", escalation.Link);
    }

    [Fact]
    public async Task Only_one_instance_runs_a_job_at_a_time()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        var organization = await Scenario.OrganizationAsync(owner);
        var project = await Scenario.ProjectAsync(owner, organization.Id);
        var today = DateOnly.FromDateTime(factory.Clock.GetUtcNow().UtcDateTime);
        for (var i = 0; i < 5; i++)
        {
            await owner.Client.PostJsonAsync<TaskDetail>($"/api/v1/projects/{project.Id}/tasks",
                new CreateTaskRequest($"Due {i}", null, null, null, owner.User.Id, today));
        }

        // Two "instances" (separate job objects, as on two servers) fire at the same moment.
        var scopes = factory.Services.GetRequiredService<IServiceScopeFactory>();
        var options = factory.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<BackgroundJobOptions>>();
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<DueDateReminderJob>.Instance;
        var first = new DueDateReminderJob(scopes, options, logger);
        var second = new DueDateReminderJob(scopes, options, logger);
        await Task.WhenAll(first.RunOnceAsync(Ct), second.RunOnceAsync(Ct));

        Assert.Equal(5, (await InboxAsync(owner, "task.due_soon")).Count);
    }

    [Fact]
    public async Task Retention_removes_old_finished_invitations()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        var organization = await Scenario.OrganizationAsync(owner);
        var invitation = await owner.Client.PostJsonAsync<InvitationResponse>($"/api/v1/organizations/{organization.Id}/invitations",
            new CreateInvitationRequest(TestData.UniqueEmail("invitee"), OrganizationRole.Member));
        await owner.Client.DeleteAsync($"/api/v1/organizations/{organization.Id}/invitations/{invitation.Id}");

        factory.Clock.Advance(TimeSpan.FromDays(31));
        await factory.Job<DataRetentionJob>().RunOnceAsync(Ct);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();
        Assert.False(await db.Invitations.AnyAsync(i => i.Id == invitation.Id, Ct));
    }
}
