using DevFlow.Domain.Organizations;
using DevFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("organizations");
        builder.Property(o => o.Name).HasMaxLength(80).IsRequired();
        builder.HasOne<User>().WithMany().HasForeignKey(o => o.CreatedById).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> builder)
    {
        builder.ToTable("memberships");
        builder.HasKey(m => new { m.OrganizationId, m.UserId });
        // Stored as text ("Owner") rather than 0/1/2, so the data is readable in SQL tools.
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);

        builder.HasOne(m => m.Organization).WithMany(o => o.Members).HasForeignKey(m => m.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);

        // "Which organizations is this user in?" runs on every request.
        builder.HasIndex(m => m.UserId);
    }
}

internal sealed class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("invitations");
        builder.Property(i => i.Email).HasMaxLength(256).IsRequired();
        builder.Property(i => i.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.TokenHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(i => i.TokenHash).IsUnique();
        builder.HasIndex(i => new { i.OrganizationId, i.Email });

        builder.HasOne(i => i.Organization).WithMany().HasForeignKey(i => i.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(i => i.InvitedBy).WithMany().HasForeignKey(i => i.InvitedById).OnDelete(DeleteBehavior.Restrict);
    }
}
