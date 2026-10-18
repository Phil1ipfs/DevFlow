using System.Collections.Concurrent;
using DevFlow.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Email;

public sealed record CapturedEmail(DateTimeOffset SentAt, string To, string Subject, string TextBody);

/// <summary>
/// Development/testing stand-in for an email provider: keeps the most recent messages in memory
/// so developers and end-to-end tests can read password-reset and invitation links via
/// GET /api/v1/dev/emails (an endpoint that only exists outside Production).
/// </summary>
public sealed class DevMailbox
{
    private const int Capacity = 100;
    private readonly ConcurrentQueue<CapturedEmail> _messages = new();

    public void Add(CapturedEmail email)
    {
        _messages.Enqueue(email);
        while (_messages.Count > Capacity && _messages.TryDequeue(out _))
        {
        }
    }

    public IReadOnlyList<CapturedEmail> Recent(string? to = null) =>
        _messages
            .Where(m => to is null || string.Equals(m.To, to, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(m => m.SentAt)
            .ToList();
}

internal sealed class DevMailboxEmailSender(DevMailbox mailbox, TimeProvider clock, ILogger<DevMailboxEmailSender> logger)
    : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        mailbox.Add(new CapturedEmail(clock.GetUtcNow(), message.To, message.Subject, message.TextBody));
        logger.LogInformation("Dev mailbox captured email to {To}: {Subject}", message.To, message.Subject);
        return Task.CompletedTask;
    }
}
