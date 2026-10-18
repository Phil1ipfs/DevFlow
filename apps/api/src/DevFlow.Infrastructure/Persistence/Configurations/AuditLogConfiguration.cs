using DevFlow.Domain.Audit;
using DevFlow.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");
        builder.Property(a => a.Action).HasMaxLength(64).IsRequired();
        builder.Property(a => a.TargetType).HasMaxLength(32).IsRequired();
        builder.Property(a => a.Summary).HasMaxLength(500).IsRequired();
        builder.Property(a => a.IpAddress).HasMaxLength(45);
        builder.Property(a => a.Metadata).AsJsonb();

        // The audit screen lists an organization's newest entries first.
        builder.HasIndex(a => new { a.OrganizationId, a.CreatedAt }).IsDescending(false, true);

        // Audit history outlives the actor's membership, so no FK to users; organizations cascade.
        builder.HasOne<Organization>().WithMany().HasForeignKey(a => a.OrganizationId).OnDelete(DeleteBehavior.Cascade);
    }
}
