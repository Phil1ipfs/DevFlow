# syntax=docker/dockerfile:1
#
# DevFlow API. Build from apps/api:
#   docker build -t devflow-api .                      # the API
#   docker build -t devflow-migrator --target migrator .   # one-off database migrations

# ---- Build -------------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, using only project files, so this layer is cached until dependencies change.
COPY global.json DevFlow.slnx dotnet-tools.json ./
COPY src/DevFlow.Api/DevFlow.Api.csproj src/DevFlow.Api/
COPY src/DevFlow.Application/DevFlow.Application.csproj src/DevFlow.Application/
COPY src/DevFlow.Domain/DevFlow.Domain.csproj src/DevFlow.Domain/
COPY src/DevFlow.Infrastructure/DevFlow.Infrastructure.csproj src/DevFlow.Infrastructure/
RUN dotnet restore src/DevFlow.Api/DevFlow.Api.csproj && dotnet tool restore

COPY src/ src/
RUN dotnet publish src/DevFlow.Api/DevFlow.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# The migrations bundle is a single executable that applies pending EF Core migrations.
# Building it starts the app's host at design time, which requires *a* connection string;
# the real one is passed at run time with --connection.
RUN ConnectionStrings__DevFlow="Host=build-placeholder;Database=devflow" \
    dotnet ef migrations bundle \
      --project src/DevFlow.Infrastructure --startup-project src/DevFlow.Api \
      --configuration Release --self-contained -r linux-x64 -o /app/efbundle

# ---- Migrator: run once per deployment, before the new API version starts ----------------------
FROM mcr.microsoft.com/dotnet/runtime-deps:10.0 AS migrator
WORKDIR /app
COPY --from=build /app/efbundle ./efbundle
USER $APP_UID
# Usage: docker run --rm -e ConnectionStrings__DevFlow=... devflow-migrator
ENTRYPOINT ["/bin/sh", "-c", "./efbundle --connection \"$ConnectionStrings__DevFlow\""]

# ---- Runtime ----------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# Non-root user built into the official .NET images.
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_gcServer=1
EXPOSE 8080

# Liveness for orchestrators: GET /api/v1/health/live. Readiness (database): GET /api/v1/health.
ENTRYPOINT ["dotnet", "DevFlow.Api.dll"]
