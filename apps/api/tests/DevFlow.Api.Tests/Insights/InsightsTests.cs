using System.Net;
using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Audit;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Reports;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tickets;
using DevFlow.Domain.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tasks;
using DevFlow.Domain.Tickets;

namespace DevFlow.Api.Tests.Insights;

[Collection(ApiCollection.Name)]
public sealed class InsightsTests(DevFlowApiFactory factory)
{
    [Fact]
    public async Task Overview_report_counts_tasks_tickets_and_workload()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        var organization = await Scenario.OrganizationAsync(owner);
        var project = await Scenario.ProjectAsync(owner, organization.Id);
        var tasksPath = $"/api/v1/projects/{project.Id}/tasks";
        await owner.Client.PostJsonAsync<TaskDetail>(tasksPath, new CreateTaskRequest("Open urgent", null, null, Priority.Urgent, owner.User.Id, null));
        await owner.Client.PostJsonAsync<TaskDetail>(tasksPath, new CreateTaskRequest("Overdue", null, null, null, null, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3))));
        await owner.Client.PostJsonAsync<TaskDetail>(tasksPath, new CreateTaskRequest("Finished", null, TaskItemStatus.Done, null, null, null));
        await owner.Client.PostJsonAsync<TicketDetail>($"/api/v1/organizations/{organization.Id}/tickets",
            new CreateTicketRequest("Broken monitor", "It flickers.", Priority.Low, TicketCategory.Hardware));

        var report = await owner.Client.GetJsonAsync<OverviewReport>($"/api/v1/organizations/{organization.Id}/reports/overview?days=7");

        Assert.Equal(2, report.Tasks.Open);
        Assert.Equal(1, report.Tasks.Overdue);
        Assert.Equal(1, report.Tasks.CompletedInPeriod);
        Assert.Equal(1, report.Tasks.ByPriority.Single(p => p.Key == "Urgent").Count);
        Assert.Equal(7, report.Tasks.Daily.Count);
        Assert.Equal(3, report.Tasks.Daily[^1].Created);
        Assert.Equal(1, report.Tickets.Open);
        Assert.Equal(1, report.Tickets.ByCategory.Single(c => c.Key == "Hardware").Count);
        Assert.Equal(1, Assert.Single(report.Workload).OpenTasks);
    }

    [Fact]
    public async Task Report_validates_period_and_membership()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        using var outsider = await Scenario.UserAsync(factory, "outsider");
        var organization = await Scenario.OrganizationAsync(owner);

        using var badPeriod = await owner.Client.GetAsync($"/api/v1/organizations/{organization.Id}/reports/overview?days=12");
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, badPeriod);
        using var notMember = await outsider.Client.GetAsync($"/api/v1/organizations/{organization.Id}/reports/overview");
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, notMember);
    }

    [Fact]
    public async Task Audit_log_records_admin_actions_and_is_admin_only()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        using var member = await Scenario.UserAsync(factory, "member");
        var organization = await Scenario.OrganizationAsync(owner, "Audited");
        await Scenario.JoinAsync(owner, organization.Id, member);
        await owner.Client.PatchJsonAsync<MemberResponse>($"/api/v1/organizations/{organization.Id}/members/{member.User.Id}",
            new ChangeMemberRoleRequest(OrganizationRole.Admin));
        var path = $"/api/v1/organizations/{organization.Id}/audit-logs";

        var all = await owner.Client.GetJsonAsync<PagedResult<AuditLogResponse>>(path);
        Assert.Equal(
            ["member.role_changed", "member.joined", "invitation.created", "organization.created"],
            all.Items.Select(a => a.Action));
        var roleChange = all.Items[0];
        Assert.Equal(owner.User.Id, roleChange.Actor!.Id);
        Assert.Equal("Admin", roleChange.Metadata["to"]);

        var memberEvents = await owner.Client.GetJsonAsync<PagedResult<AuditLogResponse>>($"{path}?action=member.");
        Assert.Equal(2, memberEvents.TotalCount);

        // The (former) member was promoted to admin above, so use a fresh member to check access.
        using var plain = await Scenario.UserAsync(factory, "plain");
        await Scenario.JoinAsync(owner, organization.Id, plain);
        using var forbidden = await plain.Client.GetAsync(path);
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, forbidden);
    }
}
