namespace DevFlow.Application.Abstractions;

/// <summary>Builds absolute links into the web app (for emails and notifications).</summary>
public interface IAppUrls
{
    string Web(string relativePath);
}
