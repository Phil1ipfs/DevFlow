using DevFlow.Application.Common;
using DevFlow.Application.Features.Audit;
using DevFlow.Application.Features.Notifications;
using DevFlow.Application.Features.Organizations;
using DevFlow.Application.Features.Projects;
using DevFlow.Application.Features.Reports;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tickets;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.Application;

public static class DependencyInjection
{
    /// <summary>Registers application services (use cases) and request validators.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Finds every AbstractValidator<T> in this assembly and registers it as IValidator<T>.
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);

        // Scoped = one instance per HTTP request, sharing that request's DbContext.
        services.AddScoped<OrganizationAccess>();
        services.AddScoped<AuditTrail>();
        services.AddScoped<OrganizationService>();
        services.AddScoped<MemberService>();
        services.AddScoped<InvitationService>();
        services.AddScoped<ProjectService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<TaskService>();
        services.AddScoped<TaskCommentService>();
        services.AddScoped<TicketService>();
        services.AddScoped<ReportService>();
        services.AddScoped<AuditLogService>();

        return services;
    }
}
