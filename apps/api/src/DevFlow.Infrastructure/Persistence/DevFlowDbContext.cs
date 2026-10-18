using DevFlow.Application.Abstractions;
using DevFlow.Domain.Audit;
using DevFlow.Domain.Notifications;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Projects;
using DevFlow.Domain.Tasks;
using DevFlow.Domain.Tickets;
using DevFlow.Domain.Users;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence;

/// <summary>
/// EF Core unit of work for the DevFlow PostgreSQL database.
/// </summary>
/// <remarks>
/// Inherits Identity's user tables (users, claims, logins, tokens). It deliberately uses
/// <see cref="IdentityUserContext{TUser, TKey}"/> rather than IdentityDbContext: DevFlow's roles
/// are per organization, so global Identity role tables would be unused.
/// </remarks>
public sealed class DevFlowDbContext(DbContextOptions<DevFlowDbContext> options)
    : IdentityUserContext<User, Guid>(options), IAppDbContext, IDataProtectionKeyContext
{
    /// <summary>
    /// ASP.NET Core data-protection keys (they encrypt auth cookies, antiforgery and reset tokens).
    /// Stored in the database so every API instance shares them and they survive redeploys;
    /// otherwise each restart would sign everybody out.
    /// </summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<Membership> Memberships => Set<Membership>();

    public DbSet<Invitation> Invitations => Set<Invitation>();

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    public DbSet<TaskComment> TaskComments => Set<TaskComment>();

    public DbSet<TaskActivity> TaskActivities => Set<TaskActivity>();

    public DbSet<Ticket> Tickets => Set<Ticket>();

    public DbSet<TicketComment> TicketComments => Set<TicketComment>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Each entity's mapping lives in its own IEntityTypeConfiguration<T> class under
        // Persistence/Configurations; this picks them all up.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DevFlowDbContext).Assembly);

        // Shorter names than Identity's defaults ("asp_net_user_claims", ...).
        modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        modelBuilder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        modelBuilder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        modelBuilder.Entity<DataProtectionKey>().ToTable("data_protection_keys");
    }
}
