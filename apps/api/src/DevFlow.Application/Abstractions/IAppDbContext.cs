using DevFlow.Domain.Audit;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Projects;
using DevFlow.Domain.Notifications;
using DevFlow.Domain.Tasks;
using DevFlow.Domain.Tickets;
using DevFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace DevFlow.Application.Abstractions;

/// <summary>
/// The database as the application layer sees it. Services query and save through this
/// interface; the EF Core implementation (and PostgreSQL) live in Infrastructure.
/// </summary>
/// <remarks>
/// EF Core's DbContext is already a unit of work and each DbSet a repository, so DevFlow does
/// not wrap them in another repository layer. Exposing DbSets here keeps LINQ queries
/// (filtering, paging, projections) in the services where the business rules live.
/// </remarks>
public interface IAppDbContext
{
    DbSet<User> Users { get; }

    DbSet<Organization> Organizations { get; }

    DbSet<Membership> Memberships { get; }

    DbSet<Invitation> Invitations { get; }

    DbSet<Project> Projects { get; }

    DbSet<TaskItem> Tasks { get; }

    DbSet<TaskComment> TaskComments { get; }

    DbSet<TaskActivity> TaskActivities { get; }

    DbSet<Ticket> Tickets { get; }

    DbSet<TicketComment> TicketComments { get; }

    DbSet<Notification> Notifications { get; }

    DbSet<AuditLog> AuditLogs { get; }

    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
