using DevFlow.Domain.Notifications;
using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tickets;
using DevFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");
        builder.Property(t => t.Subject).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(10_000).IsRequired();
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Category).HasConversion<string>().HasMaxLength(20);
        builder.Ignore(t => t.IsOpen);

        builder.HasIndex(t => new { t.OrganizationId, t.Number }).IsUnique();
        // The helpdesk queue filters an organization's tickets by status, newest first.
        builder.HasIndex(t => new { t.OrganizationId, t.Status, t.CreatedAt });
        builder.HasIndex(t => new { t.OrganizationId, t.RequesterId });
        builder.HasIndex(t => new { t.OrganizationId, t.AssigneeId });

        builder.HasOne<Organization>().WithMany().HasForeignKey(t => t.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(t => t.Requester).WithMany().HasForeignKey(t => t.RequesterId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(t => t.Assignee).WithMany().HasForeignKey(t => t.AssigneeId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class TicketCommentConfiguration : IEntityTypeConfiguration<TicketComment>
{
    public void Configure(EntityTypeBuilder<TicketComment> builder)
    {
        builder.ToTable("ticket_comments");
        builder.Property(c => c.Body).HasMaxLength(5_000).IsRequired();
        builder.HasIndex(c => new { c.TicketId, c.CreatedAt });

        builder.HasOne<Ticket>().WithMany().HasForeignKey(c => c.TicketId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");
        builder.Property(n => n.Type).HasMaxLength(40).IsRequired();
        builder.Property(n => n.Title).HasMaxLength(200).IsRequired();
        builder.Property(n => n.Body).HasMaxLength(200);
        builder.Property(n => n.Link).HasMaxLength(300).IsRequired();

        // The bell: a user's unread notifications, newest first.
        builder.HasIndex(n => new { n.RecipientId, n.ReadAt, n.CreatedAt });

        builder.HasOne<Organization>().WithMany().HasForeignKey(n => n.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(n => n.RecipientId).OnDelete(DeleteBehavior.Cascade);
    }
}
