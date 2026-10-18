using System.Net;
using System.Net.Mail;
using DevFlow.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.Email;

/// <summary>Delivers email through an SMTP relay (e.g. Azure Communication Services, SendGrid, SES).</summary>
internal sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        using var mail = new MailMessage
        {
            From = new MailAddress(settings.FromAddress, settings.FromName),
            Subject = message.Subject,
            Body = message.TextBody,
            IsBodyHtml = false,
        };
        mail.To.Add(message.To);

        using var client = new SmtpClient(settings.SmtpHost, settings.SmtpPort)
        {
            EnableSsl = settings.SmtpUseSsl,
            Credentials = settings.SmtpUsername is null
                ? null
                : new NetworkCredential(settings.SmtpUsername, settings.SmtpPassword),
        };
        await client.SendMailAsync(mail, cancellationToken);
    }
}

/// <summary>
/// Used in Production when no SMTP host is configured. It deliberately does not log message
/// bodies, because they contain password-reset and invitation tokens.
/// </summary>
internal sealed class UnconfiguredEmailSender(ILogger<UnconfiguredEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        logger.LogError("Email '{Subject}' was not sent: set Email:SmtpHost to enable delivery.", message.Subject);
        return Task.CompletedTask;
    }
}
