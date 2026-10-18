namespace DevFlow.Application.Common;

// Application services throw these for expected failures. The API's exception handler maps
// each one to an HTTP status and an RFC 7807 problem-details response, so services stay free
// of HTTP concerns.

/// <summary>The requested resource does not exist, or the caller may not know it exists (404).</summary>
public sealed class NotFoundException(string resource) : Exception($"{resource} was not found.")
{
    public string Resource { get; } = resource;
}

/// <summary>The caller is signed in but lacks permission for this action (403).</summary>
public sealed class ForbiddenException(string message = "You do not have permission to perform this action.")
    : Exception(message);

/// <summary>The request conflicts with the current state, e.g. a duplicate (409).</summary>
public sealed class ConflictException(string message) : Exception(message);

/// <summary>Business-rule validation that cannot be expressed as a simple field rule (400).</summary>
public sealed class AppValidationException(IDictionary<string, string[]> errors)
    : Exception("One or more validation errors occurred.")
{
    public AppValidationException(string field, string error) : this(new Dictionary<string, string[]> { [field] = [error] })
    {
    }

    public IDictionary<string, string[]> Errors { get; } = errors;
}
