namespace DevFlow.Infrastructure.Email;

/// <summary>Bound from the "Email" configuration section.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string FromAddress { get; set; } = "no-reply@devflow.local";

    public string FromName { get; set; } = "DevFlow";

    /// <summary>SMTP host. When empty, development builds keep emails in the in-memory dev mailbox.</summary>
    public string? SmtpHost { get; set; }

    public int SmtpPort { get; set; } = 587;

    public bool SmtpUseSsl { get; set; } = true;

    public string? SmtpUsername { get; set; }

    /// <summary>Secret: set via user-secrets or an environment variable, never appsettings.json.</summary>
    public string? SmtpPassword { get; set; }
}
