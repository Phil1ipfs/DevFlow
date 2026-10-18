using System.Net;
using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Tickets;
using DevFlow.Domain.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tickets;

namespace DevFlow.Api.Tests.Tickets;

[Collection(ApiCollection.Name)]
public sealed class TicketTests(DevFlowApiFactory factory)
{
    private sealed record Helpdesk(Scenario.Actor Agent, Scenario.Actor Requester, Scenario.Actor Colleague, OrganizationResponse Organization) : IDisposable
    {
        public void Dispose()
        {
            Agent.Dispose();
            Requester.Dispose();
            Colleague.Dispose();
        }
    }

    private async Task<Helpdesk> SetupAsync()
    {
        var agent = await Scenario.UserAsync(factory, "agent");
        var requester = await Scenario.UserAsync(factory, "requester");
        var colleague = await Scenario.UserAsync(factory, "colleague");
        var organization = await Scenario.OrganizationAsync(agent, "Helpdesk Co");
        await Scenario.JoinAsync(agent, organization.Id, requester);
        await Scenario.JoinAsync(agent, organization.Id, colleague);
        return new Helpdesk(agent, requester, colleague, organization);
    }

    private static Task<TicketDetail> RaiseAsync(Scenario.Actor actor, Guid organizationId, string subject, Priority priority = Priority.Medium) =>
        actor.Client.PostJsonAsync<TicketDetail>($"/api/v1/organizations/{organizationId}/tickets",
            new CreateTicketRequest(subject, "Details of the problem.", priority, TicketCategory.Hardware));

    private static async Task<int> UnreadAsync(Scenario.Actor actor) =>
        (await actor.Client.GetJsonAsync<UnreadCountResponse>("/api/v1/notifications/unread-count")).Count;

    [Fact]
    public async Task Ticket_lifecycle_follows_agent_and_requester_rules()
    {
        using var h = await SetupAsync();
        var ticket = await RaiseAsync(h.Requester, h.Organization.Id, "Laptop won't boot");
        Assert.Equal(1, ticket.Number);
        Assert.Equal(TicketStatus.Open, ticket.Status);
        Assert.False(ticket.Permissions.CanTriage);

        // The agent assigns it to themselves: it moves to In progress.
        var assigned = await h.Agent.Client.PatchJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}",
            new UpdateTicketRequest(AssigneeId: h.Agent.User.Id));
        Assert.Equal(TicketStatus.InProgress, assigned.Status);

        // Asking the requester a question notifies them; their reply moves it back to In progress.
        await h.Agent.Client.PatchJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(Status: TicketStatus.WaitingOnRequester));
        await h.Agent.Client.PostJsonAsync<TicketCommentResponse>($"/api/v1/tickets/{ticket.Id}/comments", new TicketCommentRequest("Does the power light come on?"));
        Assert.True(await UnreadAsync(h.Requester) >= 2);
        await h.Requester.Client.PostJsonAsync<TicketCommentResponse>($"/api/v1/tickets/{ticket.Id}/comments", new TicketCommentRequest("No light at all."));
        var afterReply = await h.Agent.Client.GetJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}");
        Assert.Equal(TicketStatus.InProgress, afterReply.Status);
        Assert.NotNull(afterReply.FirstResponseAt);

        // Internal notes stay with the agents.
        await h.Agent.Client.PostJsonAsync<TicketCommentResponse>($"/api/v1/tickets/{ticket.Id}/comments",
            new TicketCommentRequest("Probably the PSU; order a spare.", IsInternal: true));
        var requesterView = await h.Requester.Client.GetJsonAsync<List<TicketCommentResponse>>($"/api/v1/tickets/{ticket.Id}/comments");
        var agentView = await h.Agent.Client.GetJsonAsync<List<TicketCommentResponse>>($"/api/v1/tickets/{ticket.Id}/comments");
        Assert.DoesNotContain(requesterView, c => c.IsInternal);
        Assert.Single(agentView, c => c.IsInternal);

        // Requesters may close or reopen, but not move it through the workflow.
        var resolved = await h.Agent.Client.PatchJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(Status: TicketStatus.Resolved));
        Assert.NotNull(resolved.ResolvedAt);
        using var illegal = await h.Requester.Client.PatchAsync($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(Status: TicketStatus.InProgress));
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, illegal);
        var reopened = await h.Requester.Client.PatchJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(Status: TicketStatus.Open));
        Assert.Equal(TicketStatus.Open, reopened.Status);
        Assert.Null(reopened.ResolvedAt);
    }

    [Fact]
    public async Task Members_only_see_their_own_tickets()
    {
        using var h = await SetupAsync();
        var ticket = await RaiseAsync(h.Requester, h.Organization.Id, "VPN keeps dropping");

        var colleagueQueue = await h.Colleague.Client.GetJsonAsync<PagedResult<TicketSummary>>($"/api/v1/organizations/{h.Organization.Id}/tickets");
        Assert.DoesNotContain(colleagueQueue.Items, t => t.Id == ticket.Id);
        using var direct = await h.Colleague.Client.GetAsync($"/api/v1/tickets/{ticket.Id}");
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, direct);

        var agentQueue = await h.Agent.Client.GetJsonAsync<PagedResult<TicketSummary>>($"/api/v1/organizations/{h.Organization.Id}/tickets");
        Assert.Contains(agentQueue.Items, t => t.Id == ticket.Id);

        // Once assigned, the colleague can see and work it.
        await h.Agent.Client.PatchJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(AssigneeId: h.Colleague.User.Id));
        var assignedView = await h.Colleague.Client.GetJsonAsync<TicketDetail>($"/api/v1/tickets/{ticket.Id}");
        Assert.True(assignedView.Permissions.CanChangeStatus);
        Assert.False(assignedView.Permissions.CanTriage);
        Assert.Equal(1, await UnreadAsync(h.Colleague));
    }

    [Fact]
    public async Task Members_cannot_triage_or_write_internal_notes()
    {
        using var h = await SetupAsync();
        var ticket = await RaiseAsync(h.Requester, h.Organization.Id, "Need Figma access");

        using var triage = await h.Requester.Client.PatchAsync($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(Priority: Priority.Urgent));
        using var assign = await h.Requester.Client.PatchAsync($"/api/v1/tickets/{ticket.Id}", new UpdateTicketRequest(AssigneeId: h.Requester.User.Id));
        using var note = await h.Requester.Client.PostAsync($"/api/v1/tickets/{ticket.Id}/comments", new TicketCommentRequest("secret", true));
        foreach (var response in new[] { triage, assign, note })
        {
            await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, response);
        }
    }

    [Fact]
    public async Task High_priority_tickets_notify_agents_and_queue_puts_them_first()
    {
        using var h = await SetupAsync();
        var before = await UnreadAsync(h.Agent);
        await RaiseAsync(h.Requester, h.Organization.Id, "Printer jammed", Priority.Low);
        var urgent = await RaiseAsync(h.Requester, h.Organization.Id, "Production database down", Priority.Urgent);

        Assert.Equal(before + 1, await UnreadAsync(h.Agent));
        var queue = await h.Agent.Client.GetJsonAsync<PagedResult<TicketSummary>>($"/api/v1/organizations/{h.Organization.Id}/tickets");
        Assert.Equal(urgent.Id, queue.Items[0].Id);

        var byNumber = await h.Agent.Client.GetJsonAsync<PagedResult<TicketSummary>>(
            $"/api/v1/organizations/{h.Organization.Id}/tickets?search=%23{urgent.Number}");
        Assert.Equal(urgent.Id, Assert.Single(byNumber.Items).Id);
    }

    [Fact]
    public async Task Ticket_numbers_are_unique_under_concurrency()
    {
        using var h = await SetupAsync();
        var tickets = await Task.WhenAll(Enumerable.Range(1, 10).Select(i => RaiseAsync(h.Requester, h.Organization.Id, $"Ticket {i}")));
        Assert.Equal(Enumerable.Range(1, 10), tickets.Select(t => t.Number).Order());
    }
}
