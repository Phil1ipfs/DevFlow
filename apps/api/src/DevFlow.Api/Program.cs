using System.Text.Json.Serialization;
using DevFlow.Api.Common;
using DevFlow.Api.Health;
using DevFlow.Api.Realtime;
using DevFlow.Api.Security;
using DevFlow.Application;
using DevFlow.Application.Abstractions;
using DevFlow.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc.Controllers;

var builder = WebApplication.CreateBuilder(args);
var environment = builder.Environment;
var includeDevEndpoints = environment.IsDevelopment() || environment.IsEnvironment("Testing");

// Production logs are one JSON object per line, ready for a log collector.
if (environment.IsProduction())
{
    builder.Logging.ClearProviders();
    builder.Logging.AddJsonConsole();
}

// A JSON API never needs large bodies; reject anything over 1 MB early.
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1_048_576);

// ---- Services (dependency injection container) ----
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection(AppOptions.SectionName));

builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApplicationPartManager(manager =>
    {
        manager.FeatureProviders.Remove(manager.FeatureProviders.OfType<ControllerFeatureProvider>().Single());
        manager.FeatureProviders.Add(new DevOnlyControllerFeatureProvider(includeDevEndpoints));
    });
// FluentValidation (ValidationFilter) owns request validation; turn off MVC's automatic 400
// so there is exactly one validation response shape.
builder.Services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options =>
    options.SuppressModelStateInvalidFilter = true);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<IAppUrls, AppUrls>();
builder.Services.AddSignalR();
builder.Services.AddSingleton<INotificationPublisher, SignalRNotificationPublisher>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, environment);
builder.Services.AddDevFlowSecurity(environment, builder.Configuration);

// The Next.js server proxies /api requests. Trust its X-Forwarded-* headers so client IPs (for
// rate limiting and audit logs) and the request scheme are correct. Loopback is trusted by
// default; in containers, list the proxy's network in Proxy:TrustedNetworks (CIDR), e.g. the
// Docker network "172.16.0.0/12". Never trust everything: anyone could then spoof their IP.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var cidr in builder.Configuration.GetSection("Proxy:TrustedNetworks").Get<string[]>() ?? [])
    {
        options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(cidr));
    }
});

var app = builder.Build();

// ---- HTTP request pipeline (middleware runs in the order it is added) ----
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    // TLS terminates at the load balancer / ingress in front of the app, so the API itself does
    // not redirect HTTP to HTTPS (that would break internal health probes). HSTS is still sent
    // on HTTPS responses so browsers never downgrade.
    app.UseHsts();
}

app.UseRateLimiter();
app.UseAuthentication();
// After authentication: antiforgery tokens are bound to the signed-in user.
app.UseMiddleware<AntiforgeryMiddleware>();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapControllers();
app.MapHub<NotificationHub>(NotificationHub.Path);

app.Run();
