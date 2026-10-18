using DevFlow.Infrastructure.Email;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

/// <summary>
/// Development-only helpers. Program.cs removes this controller from the app outside the
/// Development and Testing environments, so these routes do not exist in Production.
/// </summary>
[ApiController]
[Route("api/v1/dev")]
[AllowAnonymous]
public sealed class DevController(DevMailbox mailbox) : ControllerBase
{
    /// <summary>Recently "sent" emails, newest first. Optional filter by recipient.</summary>
    [HttpGet("emails")]
    public IReadOnlyList<CapturedEmail> Emails([FromQuery] string? to) => mailbox.Recent(to);
}
