# DevFlow

Project management and IT helpdesk for engineering teams: workspaces, projects, a Kanban board,
task tracking, an IT ticket queue, real-time notifications, reports and an audit trail.

| Part | Path | Stack |
| --- | --- | --- |
| Web | `apps/web` | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod, dnd-kit, SignalR client |
| API | `apps/api` | ASP.NET Core 10, EF Core 10 + PostgreSQL, ASP.NET Core Identity (cookies), FluentValidation, SignalR, HybridCache |
| Infra | `infra`, `.github` | Dockerfiles, docker-compose, GitHub Actions CI |

Further reading: [architecture](docs/architecture.md) · [testing](docs/testing.md) · [deployment](docs/deployment.md)

## Features

- **Accounts:** registration, sign-in with lockout, password reset by email, profile and password changes; HttpOnly session cookies with CSRF protection and rate limiting.
- **Workspaces:** organizations with Owner/Admin/Member roles, email invitations, strict per-organization data isolation, workspace switcher.
- **Projects and tasks:** project keys (`WEB-42`), Kanban board with pointer *and* keyboard drag-and-drop, list view with search/filters/pagination, task details with comments and activity history, My tasks.
- **Helpdesk:** ticket queue for admins, requester view for members, internal notes, first-response and resolution tracking, escalation of waiting urgent tickets.
- **Real time:** in-app notifications pushed over SignalR (bell + toasts), plus due-date reminders.
- **Insights:** reports (tasks, tickets, workload) and an admin audit log of security-relevant actions.

## Prerequisites

- .NET SDK 10.0.4xx (`dotnet --list-sdks`)
- Node.js 24+ and npm
- PostgreSQL 16+ (17 recommended) on port 5432 — or Docker, see [Run everything with Docker](#run-everything-with-docker)

## First-time setup

### 1. Database

```sql
CREATE ROLE devflow WITH LOGIN PASSWORD 'choose-a-local-password' CREATEDB;  -- CREATEDB lets tests create throwaway databases
CREATE DATABASE devflow OWNER devflow;
```

### 2. Secrets (never stored in the repository)

```bash
cd apps/api
dotnet user-secrets set "ConnectionStrings:DevFlow" \
  "Host=localhost;Port=5432;Database=devflow;Username=devflow;Password=choose-a-local-password" --project src/DevFlow.Api
dotnet user-secrets set "ConnectionStrings:DevFlowTest" \
  "Host=localhost;Port=5432;Database=postgres;Username=devflow;Password=choose-a-local-password" --project tests/DevFlow.Api.Tests
```

Elsewhere, use environment variables: `ConnectionStrings__DevFlow`, `ConnectionStrings__DevFlowTest`.

### 3. Migrations and packages

```bash
cd apps/api
dotnet tool restore
dotnet ef database update --project src/DevFlow.Infrastructure --startup-project src/DevFlow.Api

cd ../web
npm install
```

## Running locally

```bash
# Terminal 1: API on http://localhost:5270
cd apps/api
dotnet run --project src/DevFlow.Api

# Terminal 2: web on http://localhost:3000
cd apps/web
npm run dev
```

Open http://localhost:3000, create an account and a workspace.

| URL | Purpose |
| --- | --- |
| http://localhost:3000/ | Landing page |
| http://localhost:3000/app | The application (sign-in required) |
| http://localhost:3000/status | Live web → API → database status |
| http://localhost:5270/api/v1/health | Readiness (API + database); `/api/v1/health/live` for liveness |
| http://localhost:5270/openapi/v1.json | OpenAPI document (Development only) |
| http://localhost:5270/api/v1/dev/emails | Development mailbox: reset and invitation emails (not in Production) |

In development, emails are not sent; they appear in the dev mailbox above. Configure
`Email:SmtpHost` (and related settings) to deliver real email.

## Checks

```bash
# API: build + 47 integration tests against real PostgreSQL
cd apps/api && dotnet build && dotnet test

# Web: lint, production build, typecheck
cd apps/web && npm run lint && npm run build && npm run typecheck

# End-to-end (needs the API and web running; see docs/testing.md)
cd apps/web && E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Run everything with Docker

```bash
cp infra/.env.example infra/.env        # set POSTGRES_PASSWORD
docker compose -f infra/docker-compose.yml --env-file infra/.env up --build
```

This starts PostgreSQL, runs the migrations, then the API (http://localhost:8080) and the web app
(http://localhost:3000). See [docs/deployment.md](docs/deployment.md) for production.

## Adding a migration

```bash
cd apps/api
dotnet ef migrations add <Name> --project src/DevFlow.Infrastructure --startup-project src/DevFlow.Api --output-dir Persistence/Migrations
```

## Project structure

```text
apps/api/
├── src/DevFlow.Api              Controllers, middleware (CSRF, security headers, errors), Identity, SignalR hub
├── src/DevFlow.Application      Services (use cases), DTOs, validators, interfaces
├── src/DevFlow.Domain           Entities and business rules
├── src/DevFlow.Infrastructure   EF Core DbContext, mappings, migrations, email, background jobs
└── tests/DevFlow.Api.Tests      xUnit v3 integration tests
apps/web/
├── src/app                      Routes: (marketing), (auth), app/*
├── src/components               UI by feature (app-shell, tasks, tickets, reports, …) and ui/ (shadcn)
├── src/lib                      API client, query hooks, forms, utilities
└── e2e                          Playwright tests
infra/                           docker-compose and environment template
docs/                            Architecture, testing and deployment guides
```
