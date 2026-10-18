using System.Text.RegularExpressions;
using DevFlow.Application.Features.Auth;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Projects;
using DevFlow.Domain.Organizations;

namespace DevFlow.Api.Tests.Infrastructure;

/// <summary>Builders for common multi-step setups (users, organizations, memberships).</summary>
public static partial class Scenario
{
    public sealed record Actor(TestApiClient Client, CurrentUserResponse User) : IDisposable
    {
        public void Dispose() => Client.Dispose();
    }

    public static async Task<Actor> UserAsync(DevFlowApiFactory factory, string name = "user")
    {
        var client = factory.CreateApiClient();
        var user = await client.RegisterAsync(TestData.UniqueEmail(name), displayName: name);
        return new Actor(client, user);
    }

    public static Task<OrganizationResponse> OrganizationAsync(Actor owner, string name = "Acme") =>
        owner.Client.PostJsonAsync<OrganizationResponse>("/api/v1/organizations", new CreateOrganizationRequest(name));

    public static Task<ProjectResponse> ProjectAsync(Actor admin, Guid organizationId, string key = "WEB", string name = "Website") =>
        admin.Client.PostJsonAsync<ProjectResponse>($"/api/v1/organizations/{organizationId}/projects",
            new CreateProjectRequest(name, key, null, null));

    /// <summary>Invites <paramref name="invitee"/> via the real email flow and accepts the invitation.</summary>
    public static async Task JoinAsync(Actor admin, Guid organizationId, Actor invitee, OrganizationRole role = OrganizationRole.Member)
    {
        await admin.Client.PostJsonAsync<InvitationResponse>($"/api/v1/organizations/{organizationId}/invitations",
            new CreateInvitationRequest(invitee.User.Email, role));
        var token = await LatestInvitationTokenAsync(admin.Client, invitee.User.Email);
        await invitee.Client.PostJsonAsync<AcceptInvitationResponse>($"/api/v1/invitations/{token}/accept");
    }

    public static async Task<string> LatestInvitationTokenAsync(TestApiClient client, string email)
    {
        var emails = await client.GetJsonAsync<List<EmailDto>>($"/api/v1/dev/emails?to={Uri.EscapeDataString(email)}");
        var latest = emails.First(e => e.Subject.Contains("invited you"));
        return InviteLink().Match(latest.TextBody).Groups[1].Value;
    }

    public sealed record EmailDto(string To, string Subject, string TextBody);

    [GeneratedRegex(@"/invite/([A-Za-z0-9_\-]+)")]
    private static partial Regex InviteLink();
}
