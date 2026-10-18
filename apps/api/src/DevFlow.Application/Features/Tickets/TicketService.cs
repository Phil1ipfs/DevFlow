using DevFlow.Application.Abstractions;
using DevFlow.Application.Common;
using DevFlow.Application.Features.Notifications;
using DevFlow.Domain.Common;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tickets;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Application.Features.Tickets;

/// <summary>
/// IT helpdesk. Admins act as agents: they see the whole queue, triage, assign and write
/// internal notes. Members see only tickets they raised or are assigned to.
/// </summary>
public sealed class TicketService(
    IAppDbContext db,
    ICurrentUser currentUser,
    OrganizationAccess access,
    NotificationService notifications,
    ISequenceAllocator sequences,
    TimeProvider clock)
{
    public async Task<PagedResult<TicketSummary>> ListAsync(Guid organizationId, TicketListQuery query, CancellationToken cancellationToken)
    {
        var membership = await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        var me = currentUser.Id;
        var tickets = Visible(db.Tickets.Where(t => t.OrganizationId == organizationId), membership);

        tickets = query.Scope switch
        {
            TicketScope.Requested => tickets.Where(t => t.RequesterId == me),
            TicketScope.Assigned => tickets.Where(t => t.AssigneeId == me),
            _ => tickets,
        };
        if (query.Status is { Length: > 0 } statuses) tickets = tickets.Where(t => statuses.Contains(t.Status));
        if (query.Priority is { Length: > 0 } priorities) tickets = tickets.Where(t => priorities.Contains(t.Priority));
        if (query.Category is { } category) tickets = tickets.Where(t => t.Category == category);
        if (query.Unassigned) tickets = tickets.Where(t => t.AssigneeId == null);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().TrimStart('#');
            if (int.TryParse(search, out var number)) tickets = tickets.Where(t => t.Number == number);
            else
            {
                var lowered = search.ToLowerInvariant();
                tickets = tickets.Where(t => t.Subject.ToLower().Contains(lowered));
            }
        }

        // Queue order: most urgent first, then oldest first (first come, first served).
        return await tickets
            .OrderBy(t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed)
            .ThenByDescending(t => t.Priority)
            .ThenBy(t => t.CreatedAt)
            .Select(t => new TicketSummary(
                t.Id, t.Number, t.Subject, t.Status, t.Priority, t.Category,
                new UserSummary(t.Requester.Id, t.Requester.DisplayName, t.Requester.Email!),
                t.Assignee == null ? null : new UserSummary(t.Assignee.Id, t.Assignee.DisplayName, t.Assignee.Email!),
                db.TicketComments.Count(c => c.TicketId == t.Id && (!c.IsInternal || membership.Role >= OrganizationRole.Admin)),
                t.CreatedAt, t.UpdatedAt))
            .ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);
    }

    public async Task<TicketDetail> GetAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var (ticket, membership) = await RequireTicketAsync(ticketId, cancellationToken);
        return ToDetail(ticket, membership);
    }

    public async Task<TicketDetail> CreateAsync(Guid organizationId, CreateTicketRequest request, CancellationToken cancellationToken)
    {
        var membership = await access.RequireAsync(organizationId, cancellationToken: cancellationToken);
        var now = clock.GetUtcNow();
        var ticket = new Ticket
        {
            OrganizationId = organizationId,
            Number = await sequences.NextTicketNumberAsync(organizationId, cancellationToken),
            Subject = request.Subject.Trim(),
            Description = request.Description.Trim(),
            Priority = request.Priority ?? Priority.Medium,
            Category = request.Category ?? TicketCategory.Other,
            RequesterId = currentUser.Id,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Tickets.Add(ticket);

        // Agents hear about urgent and high-priority tickets immediately; the rest wait in the queue.
        if (ticket.Priority >= Priority.High)
        {
            var agents = await db.Memberships
                .Where(m => m.OrganizationId == organizationId && m.Role >= OrganizationRole.Admin)
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);
            notifications.TicketCreated(ticket, agents);
        }

        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        return await GetAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetail> UpdateAsync(Guid ticketId, UpdateTicketRequest request, CancellationToken cancellationToken)
    {
        var (ticket, membership) = await RequireTicketAsync(ticketId, cancellationToken);
        var permissions = PermissionsFor(ticket, membership);
        var now = clock.GetUtcNow();

        if (request.Subject is not null || request.Description is not null)
        {
            if (!permissions.CanEditDetails) throw new ForbiddenException("Only the requester (while the ticket is open) or an admin can edit the details.");
            if (request.Subject is not null) ticket.Subject = request.Subject.Trim();
            if (request.Description is not null) ticket.Description = request.Description.Trim();
        }

        if (request.Priority is not null || request.Category is not null || request.AssigneeId is not null || request.ClearAssignee)
        {
            if (!permissions.CanTriage) throw new ForbiddenException("Only admins can triage and assign tickets.");
            if (request.Priority is { } priority) ticket.Priority = priority;
            if (request.Category is { } category) ticket.Category = category;
            if (request.ClearAssignee)
            {
                ticket.AssigneeId = null;
            }
            else if (request.AssigneeId is { } assigneeId && assigneeId != ticket.AssigneeId)
            {
                var isMember = await db.Memberships.AnyAsync(m => m.OrganizationId == ticket.OrganizationId && m.UserId == assigneeId, cancellationToken);
                if (!isMember) throw new AppValidationException("assigneeId", "The assignee must be a member of this organization.");
                ticket.AssigneeId = assigneeId;
                if (assigneeId != currentUser.Id) await notifications.TicketAssignedAsync(ticket, assigneeId, cancellationToken);
                if (ticket.Status == TicketStatus.Open) ticket.ChangeStatus(TicketStatus.InProgress, now);
            }
        }

        if (request.Status is { } status && status != ticket.Status)
        {
            EnsureStatusChangeAllowed(ticket, membership, status);
            ticket.ChangeStatus(status, now);
            if (ticket.RequesterId != currentUser.Id) notifications.TicketStatusChanged(ticket);
        }

        ticket.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        return await GetAsync(ticketId, cancellationToken);
    }

    public async Task<IReadOnlyList<TicketCommentResponse>> CommentsAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var (_, membership) = await RequireTicketAsync(ticketId, cancellationToken);
        var agent = membership.Role >= OrganizationRole.Admin;
        return await db.TicketComments
            .Where(c => c.TicketId == ticketId && (agent || !c.IsInternal))
            .OrderBy(c => c.CreatedAt)
            .Select(c => new TicketCommentResponse(c.Id, new UserSummary(c.Author.Id, c.Author.DisplayName, c.Author.Email!), c.Body, c.IsInternal, c.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<TicketCommentResponse> AddCommentAsync(Guid ticketId, TicketCommentRequest request, CancellationToken cancellationToken)
    {
        var (ticket, membership) = await RequireTicketAsync(ticketId, cancellationToken);
        var agent = membership.Role >= OrganizationRole.Admin;
        if (request.IsInternal && !agent) throw new ForbiddenException("Only admins can write internal notes.");

        var now = clock.GetUtcNow();
        var comment = new TicketComment
        {
            OrganizationId = ticket.OrganizationId,
            TicketId = ticket.Id,
            AuthorId = currentUser.Id,
            Body = request.Body.Trim(),
            IsInternal = request.IsInternal,
            CreatedAt = now,
        };
        db.TicketComments.Add(comment);

        var fromRequester = currentUser.Id == ticket.RequesterId;
        if (!fromRequester && !request.IsInternal) ticket.FirstResponseAt ??= now;
        // A requester answering a question puts the ticket back in the agents' court.
        if (fromRequester && ticket.Status == TicketStatus.WaitingOnRequester) ticket.ChangeStatus(TicketStatus.InProgress, now);
        ticket.UpdatedAt = now;
        await notifications.TicketCommentedAsync(ticket, comment.Body, request.IsInternal, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await notifications.PublishPendingAsync(cancellationToken);
        return new TicketCommentResponse(comment.Id,
            await db.Users.Where(u => u.Id == currentUser.Id).Select(u => new UserSummary(u.Id, u.DisplayName, u.Email!)).SingleAsync(cancellationToken),
            comment.Body, comment.IsInternal, comment.CreatedAt);
    }

    // ---------------------------------------------------------------- rules

    private IQueryable<Ticket> Visible(IQueryable<Ticket> tickets, Membership membership)
    {
        if (membership.Role >= OrganizationRole.Admin) return tickets;
        var me = currentUser.Id;
        return tickets.Where(t => t.RequesterId == me || t.AssigneeId == me);
    }

    private async Task<(Ticket Ticket, Membership Membership)> RequireTicketAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets
            .Include(t => t.Requester)
            .Include(t => t.Assignee)
            .SingleOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new NotFoundException("Ticket");

        Membership membership;
        try
        {
            membership = await access.RequireAsync(ticket.OrganizationId, cancellationToken: cancellationToken);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Ticket");
        }

        // Members cannot see other people's tickets; answer 404 so they cannot probe for them.
        var me = currentUser.Id;
        if (membership.Role < OrganizationRole.Admin && ticket.RequesterId != me && ticket.AssigneeId != me)
        {
            throw new NotFoundException("Ticket");
        }
        return (ticket, membership);
    }

    private TicketPermissions PermissionsFor(Ticket ticket, Membership membership)
    {
        var agent = membership.Role >= OrganizationRole.Admin;
        var requester = ticket.RequesterId == currentUser.Id;
        var assignee = ticket.AssigneeId == currentUser.Id;
        return new TicketPermissions(
            CanTriage: agent,
            CanEditDetails: agent || (requester && ticket.Status == TicketStatus.Open),
            CanChangeStatus: agent || assignee || requester,
            CanAddInternalNotes: agent);
    }

    /// <summary>Agents and assignees move tickets freely; requesters may only close or reopen.</summary>
    private void EnsureStatusChangeAllowed(Ticket ticket, Membership membership, TicketStatus target)
    {
        if (membership.Role >= OrganizationRole.Admin || ticket.AssigneeId == currentUser.Id) return;

        if (ticket.RequesterId == currentUser.Id)
        {
            var closing = target == TicketStatus.Closed;
            var reopening = target == TicketStatus.Open && !ticket.IsOpen;
            if (closing || reopening) return;
            throw new ForbiddenException("Requesters can close their ticket or reopen it; an agent handles the rest.");
        }
        throw new ForbiddenException();
    }

    private TicketDetail ToDetail(Ticket t, Membership membership) => new(
        t.Id, t.OrganizationId, t.Number, t.Subject, t.Description, t.Status, t.Priority, t.Category,
        new UserSummary(t.Requester.Id, t.Requester.DisplayName, t.Requester.Email!),
        t.Assignee == null ? null : new UserSummary(t.Assignee.Id, t.Assignee.DisplayName, t.Assignee.Email!),
        t.CreatedAt, t.UpdatedAt, t.FirstResponseAt, t.ResolvedAt,
        PermissionsFor(t, membership));
}
