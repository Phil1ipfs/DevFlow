using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/notifications")]
public sealed class NotificationsController(NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<NotificationResponse>> List([FromQuery] bool unreadOnly, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        notifications.ListAsync(unreadOnly, page, pageSize, ct);

    [HttpGet("unread-count")]
    public Task<UnreadCountResponse> UnreadCount(CancellationToken ct) => notifications.UnreadCountAsync(ct);

    [HttpPost("{notificationId:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid notificationId, CancellationToken ct)
    {
        await notifications.MarkReadAsync(notificationId, ct);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await notifications.MarkAllReadAsync(ct);
        return NoContent();
    }
}
