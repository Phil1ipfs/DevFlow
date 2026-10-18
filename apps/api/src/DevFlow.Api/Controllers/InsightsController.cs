using DevFlow.Application.Common;
using DevFlow.Application.Features.Audit;
using DevFlow.Application.Features.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

/// <summary>Read-only views over an organization: analytics and the audit trail.</summary>
[ApiController]
[Authorize]
[Route("api/v1/organizations/{organizationId:guid}")]
public sealed class InsightsController(ReportService reports, AuditLogService auditLogs) : ControllerBase
{
    [HttpGet("reports/overview")]
    public Task<OverviewReport> Overview(Guid organizationId, [FromQuery] int days = 30, CancellationToken ct = default) =>
        reports.OverviewAsync(organizationId, days, ct);

    [HttpGet("audit-logs")]
    public Task<PagedResult<AuditLogResponse>> AuditLogs(Guid organizationId, [FromQuery] AuditLogQuery query, CancellationToken ct) =>
        auditLogs.ListAsync(organizationId, query, ct);
}
