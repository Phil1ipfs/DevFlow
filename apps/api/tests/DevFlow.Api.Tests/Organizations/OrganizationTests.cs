using System.Net;
using DevFlow.Api.Tests.Infrastructure;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Projects;
using DevFlow.Domain.Organizations;

namespace DevFlow.Api.Tests.Organizations;

[Collection(ApiCollection.Name)]
public sealed class OrganizationTests(DevFlowApiFactory factory)
{
    [Fact]
    public async Task Creator_becomes_owner_and_sees_the_organization()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");

        var organization = await Scenario.OrganizationAsync(alice, "Acme Corp");

        Assert.Equal(OrganizationRole.Owner, organization.Role);
        Assert.Equal(1, organization.MemberCount);
        var mine = await alice.Client.GetJsonAsync<List<OrganizationResponse>>("/api/v1/organizations");
        Assert.Contains(mine, o => o.Id == organization.Id);
    }

    [Fact]
    public async Task Outsiders_cannot_see_or_touch_another_organizations_data()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");
        using var mallory = await Scenario.UserAsync(factory, "mallory");
        var organization = await Scenario.OrganizationAsync(alice);
        var project = await Scenario.ProjectAsync(alice, organization.Id);

        // Every read and write answers 404, never 403, so outsiders cannot probe for existence.
        string[] reads =
        [
            $"/api/v1/organizations/{organization.Id}",
            $"/api/v1/organizations/{organization.Id}/members",
            $"/api/v1/organizations/{organization.Id}/projects",
            $"/api/v1/organizations/{organization.Id}/invitations",
            $"/api/v1/projects/{project.Id}",
        ];
        foreach (var path in reads)
        {
            using var response = await mallory.Client.GetAsync(path);
            await HttpAssert.StatusAsync(HttpStatusCode.NotFound, response);
        }

        using var create = await mallory.Client.PostAsync($"/api/v1/organizations/{organization.Id}/projects",
            new CreateProjectRequest("Sneaky", "SNK", null, null));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, create);
        using var rename = await mallory.Client.PatchAsync($"/api/v1/projects/{project.Id}",
            new UpdateProjectRequest("Hijacked", null, null));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, rename);

        var malloryOrgs = await mallory.Client.GetJsonAsync<List<OrganizationResponse>>("/api/v1/organizations");
        Assert.DoesNotContain(malloryOrgs, o => o.Id == organization.Id);
    }

    [Fact]
    public async Task Invitation_flow_adds_the_invitee_with_the_invited_role()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");
        using var bob = await Scenario.UserAsync(factory, "bob");
        var organization = await Scenario.OrganizationAsync(alice, "Invite Co");

        await alice.Client.PostJsonAsync<InvitationResponse>($"/api/v1/organizations/{organization.Id}/invitations",
            new CreateInvitationRequest(bob.User.Email, OrganizationRole.Admin));
        var token = await Scenario.LatestInvitationTokenAsync(alice.Client, bob.User.Email);

        // The preview is public and shows only what the invitee needs.
        using var anonymous = factory.CreateApiClient();
        var preview = await anonymous.GetJsonAsync<InvitationPreviewResponse>($"/api/v1/invitations/{token}");
        Assert.Equal("Invite Co", preview.OrganizationName);
        Assert.Equal(InvitationStatus.Pending, preview.Status);

        var accepted = await bob.Client.PostJsonAsync<AcceptInvitationResponse>($"/api/v1/invitations/{token}/accept");
        Assert.Equal(organization.Id, accepted.OrganizationId);

        var members = await alice.Client.GetJsonAsync<List<MemberResponse>>($"/api/v1/organizations/{organization.Id}/members");
        Assert.Equal(OrganizationRole.Admin, Assert.Single(members, m => m.UserId == bob.User.Id).Role);

        using var reuse = await bob.Client.PostAsync($"/api/v1/invitations/{token}/accept");
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, reuse);
    }

    [Fact]
    public async Task Invitation_can_only_be_accepted_by_the_invited_email()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");
        using var bob = await Scenario.UserAsync(factory, "bob");
        using var eve = await Scenario.UserAsync(factory, "eve");
        var organization = await Scenario.OrganizationAsync(alice);

        await alice.Client.PostJsonAsync<InvitationResponse>($"/api/v1/organizations/{organization.Id}/invitations",
            new CreateInvitationRequest(bob.User.Email, OrganizationRole.Member));
        var token = await Scenario.LatestInvitationTokenAsync(alice.Client, bob.User.Email);

        using var response = await eve.Client.PostAsync($"/api/v1/invitations/{token}/accept");
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, response);
    }

    [Fact]
    public async Task Revoked_invitations_cannot_be_accepted()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");
        using var bob = await Scenario.UserAsync(factory, "bob");
        var organization = await Scenario.OrganizationAsync(alice);
        var invitation = await alice.Client.PostJsonAsync<InvitationResponse>($"/api/v1/organizations/{organization.Id}/invitations",
            new CreateInvitationRequest(bob.User.Email, OrganizationRole.Member));
        var token = await Scenario.LatestInvitationTokenAsync(alice.Client, bob.User.Email);

        using var revoke = await alice.Client.DeleteAsync($"/api/v1/organizations/{organization.Id}/invitations/{invitation.Id}");
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, revoke);

        using var accept = await bob.Client.PostAsync($"/api/v1/invitations/{token}/accept");
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, accept);
    }

    [Fact]
    public async Task Members_cannot_manage_but_admins_can()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        using var member = await Scenario.UserAsync(factory, "member");
        using var admin = await Scenario.UserAsync(factory, "admin");
        var organization = await Scenario.OrganizationAsync(owner);
        await Scenario.JoinAsync(owner, organization.Id, member);
        await Scenario.JoinAsync(owner, organization.Id, admin, OrganizationRole.Admin);

        using var memberCreatesProject = await member.Client.PostAsync($"/api/v1/organizations/{organization.Id}/projects",
            new CreateProjectRequest("Nope", "NOPE", null, null));
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, memberCreatesProject);
        using var memberInvites = await member.Client.PostAsync($"/api/v1/organizations/{organization.Id}/invitations",
            new CreateInvitationRequest(TestData.UniqueEmail(), OrganizationRole.Member));
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, memberInvites);

        var project = await Scenario.ProjectAsync(admin, organization.Id, "OPS", "Operations");
        Assert.Equal("OPS", project.Key);
        var visible = await member.Client.GetJsonAsync<List<ProjectResponse>>($"/api/v1/organizations/{organization.Id}/projects");
        Assert.Contains(visible, p => p.Id == project.Id);
    }

    [Fact]
    public async Task Only_owners_grant_ownership_and_the_last_owner_cannot_leave()
    {
        using var owner = await Scenario.UserAsync(factory, "owner");
        using var admin = await Scenario.UserAsync(factory, "admin");
        var organization = await Scenario.OrganizationAsync(owner);
        await Scenario.JoinAsync(owner, organization.Id, admin, OrganizationRole.Admin);
        var membersPath = $"/api/v1/organizations/{organization.Id}/members";

        using var adminPromotesSelf = await admin.Client.PatchAsync($"{membersPath}/{admin.User.Id}",
            new ChangeMemberRoleRequest(OrganizationRole.Owner));
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, adminPromotesSelf);

        using var lastOwnerLeaves = await owner.Client.DeleteAsync($"{membersPath}/{owner.User.Id}");
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, lastOwnerLeaves);

        await owner.Client.PatchJsonAsync<MemberResponse>($"{membersPath}/{admin.User.Id}", new ChangeMemberRoleRequest(OrganizationRole.Owner));
        using var nowLeaves = await owner.Client.DeleteAsync($"{membersPath}/{owner.User.Id}");
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, nowLeaves);

        using var gone = await owner.Client.GetAsync($"/api/v1/organizations/{organization.Id}");
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, gone);
    }

    [Fact]
    public async Task Project_keys_are_unique_per_organization()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");
        var first = await Scenario.OrganizationAsync(alice, "First");
        var second = await Scenario.OrganizationAsync(alice, "Second");

        await Scenario.ProjectAsync(alice, first.Id, "API");
        using var duplicate = await alice.Client.PostAsync($"/api/v1/organizations/{first.Id}/projects",
            new CreateProjectRequest("Another", "API", null, null));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, duplicate);

        var sameKeyElsewhere = await Scenario.ProjectAsync(alice, second.Id, "API");
        Assert.Equal("API", sameKeyElsewhere.Key);
    }

    [Fact]
    public async Task Archived_projects_are_hidden_unless_requested()
    {
        using var alice = await Scenario.UserAsync(factory, "alice");
        var organization = await Scenario.OrganizationAsync(alice);
        var project = await Scenario.ProjectAsync(alice, organization.Id);

        var archived = await alice.Client.PostJsonAsync<ProjectResponse>($"/api/v1/projects/{project.Id}/archive");
        Assert.NotNull(archived.ArchivedAt);

        var active = await alice.Client.GetJsonAsync<List<ProjectResponse>>($"/api/v1/organizations/{organization.Id}/projects");
        var all = await alice.Client.GetJsonAsync<List<ProjectResponse>>($"/api/v1/organizations/{organization.Id}/projects?includeArchived=true");
        Assert.DoesNotContain(active, p => p.Id == project.Id);
        Assert.Contains(all, p => p.Id == project.Id);
    }
}
