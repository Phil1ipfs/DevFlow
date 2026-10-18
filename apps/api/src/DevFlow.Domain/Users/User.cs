using Microsoft.AspNetCore.Identity;

namespace DevFlow.Domain.Users;

/// <summary>
/// A person who can sign in. Extends ASP.NET Core Identity's user, which already provides
/// email, password hash, lockout and security-stamp handling.
/// </summary>
/// <remarks>
/// Deriving from <see cref="IdentityUser{TKey}"/> makes the domain depend on the small
/// Identity "stores" package (no EF Core, no ASP.NET). That is a deliberate, common trade-off:
/// it avoids keeping a second user table in sync with Identity's.
/// </remarks>
public class User : IdentityUser<Guid>
{
    public User()
    {
        Id = Guid.CreateVersion7();
        SecurityStamp = Guid.NewGuid().ToString();
    }

    public User(string email, string displayName) : this()
    {
        Email = email;
        UserName = email;
        DisplayName = displayName;
    }

    public string DisplayName { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
