using DevFlow.Domain.Organizations;
using DevFlow.Domain.Projects;
using DevFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("projects");
        builder.Property(p => p.Name).HasMaxLength(80).IsRequired();
        builder.Property(p => p.Key).HasMaxLength(10).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(2000);
        builder.Ignore(p => p.IsArchived);

        builder.HasIndex(p => new { p.OrganizationId, p.Key }).IsUnique();

        builder.HasOne<Organization>().WithMany().HasForeignKey(p => p.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(p => p.Lead).WithMany().HasForeignKey(p => p.LeadId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(p => p.CreatedById).OnDelete(DeleteBehavior.Restrict);
    }
}
