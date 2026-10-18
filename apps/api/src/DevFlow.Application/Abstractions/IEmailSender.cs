namespace DevFlow.Application.Abstractions;

public sealed record EmailMessage(string To, string Subject, string TextBody);

/// <summary>Sends transactional email (password resets, invitations).</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
