using DevFlow.Domain.Organizations;
using DevFlow.Domain.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("tasks");
        builder.Property(t => t.Title).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(10_000);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(20);
        builder.Ignore(t => t.IsArchived);

        // Task numbers are unique within a project (WEB-1, WEB-2, ...).
        builder.HasIndex(t => new { t.ProjectId, t.Number }).IsUnique();
        // The board: one project's tasks, grouped by status, ordered by position.
        builder.HasIndex(t => new { t.ProjectId, t.Status, t.Position });
        // "My tasks": everything assigned to one person in an organization.
        builder.HasIndex(t => new { t.OrganizationId, t.AssigneeId });

        builder.HasOne<Organization>().WithMany().HasForeignKey(t => t.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(t => t.Project).WithMany().HasForeignKey(t => t.ProjectId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(t => t.Assignee).WithMany().HasForeignKey(t => t.AssigneeId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(t => t.Reporter).WithMany().HasForeignKey(t => t.ReporterId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class TaskCommentConfiguration : IEntityTypeConfiguration<TaskComment>
{
    public void Configure(EntityTypeBuilder<TaskComment> builder)
    {
        builder.ToTable("task_comments");
        builder.Property(c => c.Body).HasMaxLength(5_000).IsRequired();
        builder.HasIndex(c => new { c.TaskId, c.CreatedAt });

        builder.HasOne<TaskItem>().WithMany().HasForeignKey(c => c.TaskId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class TaskActivityConfiguration : IEntityTypeConfiguration<TaskActivity>
{
    public void Configure(EntityTypeBuilder<TaskActivity> builder)
    {
        builder.ToTable("task_activities");
        builder.Property(a => a.Type).HasMaxLength(40).IsRequired();
        builder.Property(a => a.Data).AsJsonb();
        builder.HasIndex(a => new { a.TaskId, a.CreatedAt });

        builder.HasOne<TaskItem>().WithMany().HasForeignKey(a => a.TaskId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(a => a.Actor).WithMany().HasForeignKey(a => a.ActorId).OnDelete(DeleteBehavior.Restrict);
    }
}
