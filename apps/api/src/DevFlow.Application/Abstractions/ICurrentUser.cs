namespace DevFlow.Application.Abstractions;

/// <summary>
/// The signed-in user for the current request. Implemented in the API layer from the auth
/// cookie, so application services never touch HttpContext directly.
/// </summary>
public interface ICurrentUser
{
    /// <summary>The user's id. Throws if the request is anonymous.</summary>
    Guid Id { get; }

    bool IsAuthenticated { get; }

    /// <summary>The client's IP address, recorded in audit logs.</summary>
    string? IpAddress { get; }
}
