namespace DevFlow.Api.Common;

/// <summary>Bound from the "App" configuration section.</summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    /// <summary>Public URL of the web app, used to build links in emails.</summary>
    public string WebBaseUrl { get; set; } = "http://localhost:3000";
}
