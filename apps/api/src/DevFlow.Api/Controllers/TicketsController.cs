using DevFlow.Application.Common;
using DevFlow.Application.Features.Tickets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TicketsController(TicketService tickets) : ControllerBase
{
    [HttpGet("api/v1/organizations/{organizationId:guid}/tickets")]
    public Task<PagedResult<TicketSummary>> List(Guid organizationId, [FromQuery] TicketListQuery query, CancellationToken ct) =>
        tickets.ListAsync(organizationId, query, ct);

    [HttpPost("api/v1/organizations/{organizationId:guid}/tickets")]
    public async Task<ActionResult<TicketDetail>> Create(Guid organizationId, CreateTicketRequest request, CancellationToken ct)
    {
        var ticket = await tickets.CreateAsync(organizationId, request, ct);
        return CreatedAtAction(nameof(Get), new { ticketId = ticket.Id }, ticket);
    }

    [HttpGet("api/v1/tickets/{ticketId:guid}")]
    public Task<TicketDetail> Get(Guid ticketId, CancellationToken ct) => tickets.GetAsync(ticketId, ct);

    [HttpPatch("api/v1/tickets/{ticketId:guid}")]
    public Task<TicketDetail> Update(Guid ticketId, UpdateTicketRequest request, CancellationToken ct) => tickets.UpdateAsync(ticketId, request, ct);

    [HttpGet("api/v1/tickets/{ticketId:guid}/comments")]
    public Task<IReadOnlyList<TicketCommentResponse>> Comments(Guid ticketId, CancellationToken ct) => tickets.CommentsAsync(ticketId, ct);

    [HttpPost("api/v1/tickets/{ticketId:guid}/comments")]
    public async Task<ActionResult<TicketCommentResponse>> AddComment(Guid ticketId, TicketCommentRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await tickets.AddCommentAsync(ticketId, request, ct));
}
