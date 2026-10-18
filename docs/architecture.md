# DevFlow architecture

## System

```text
Browser ──► Next.js (apps/web) ──/api, /hubs──► ASP.NET Core API (apps/api) ──► PostgreSQL
              static shells,                      REST + SignalR,
              client data (TanStack Query)        Identity cookies, EF Core
```

- **Same origin.** The browser only talks to the Next.js server, which proxies `/api/*` and
  `/hubs/*` to the API. Cookies are first-party; there is no CORS configuration.
- **The API is the security boundary.** Every request is authenticated (HttpOnly cookie) and
  authorized (organization membership and role) in the API. The web app's `proxy.ts` only redirects
  visitors who have no session cookie at all, as a convenience.
- **Pages are static shells.** `/app` pages prerender without user data; data loads in the browser
  through TanStack Query. A small wrapper (`src/lib/query.ts`) keeps hydration consistent.

## Backend layers (modular monolith)

| Project | Contains | Depends on |
| --- | --- | --- |
| `DevFlow.Domain` | Entities and rules (`Organization`, `Project`, `TaskItem`, `Ticket`, …) | nothing (plus the Identity user base class) |
| `DevFlow.Application` | Use cases (services), DTOs, FluentValidation validators, interfaces such as `IAppDbContext`, `ICurrentUser`, `IEmailSender` | Domain, EF Core abstractions |
| `DevFlow.Infrastructure` | `DevFlowDbContext`, entity mappings, migrations, email senders, background jobs, sequence allocator | Application |
| `DevFlow.Api` | Controllers, middleware (CSRF, security headers, errors), Identity/cookie setup, SignalR hub | Application, Infrastructure |

A request flows **controller → service → `IAppDbContext` → PostgreSQL**:

- **Controllers** translate HTTP into method calls and back. No business rules.
- **Services** (`TaskService`, `TicketService`, …) hold the rules: who may do what, what changes,
  what is recorded. They throw `NotFoundException` / `ForbiddenException` / … which the API's
  `ApiExceptionHandler` turns into RFC 7807 problem responses.
- **DTOs** (`TaskSummary`, `CreateTaskRequest`, …) are the JSON contracts; entities never leave the API.
- **Entities** are persisted with EF Core; each has its own `IEntityTypeConfiguration`.

## Key decisions

| Decision | Why |
| --- | --- |
| Cookie auth (ASP.NET Core Identity), not JWT in the browser | HttpOnly cookies cannot be read by injected scripts; no token storage in `localStorage`. |
| CSRF tokens on every state-changing request (`X-CSRF-TOKEN`) | Defence in depth on top of `SameSite=Lax`. |
| Tenant isolation in one place (`OrganizationAccess`) | Every service checks membership first; outsiders get **404**, so they can't probe for IDs. |
| UUID v7 primary keys | Globally unique, yet time-ordered, so inserts stay index-friendly. |
| Atomic sequence numbers (`UPDATE … RETURNING`) | `WEB-42` and ticket `#17` never collide under concurrency. |
| Fractional task positions | A drag-and-drop move updates one row; the column is renumbered only when gaps run out. |
| Audit entries and notifications saved in the same transaction as the change | The record and the action can never disagree. |
| SignalR for real time, pushed after the transaction commits | Clients never see a notification for a change that was rolled back. |
| `HybridCache` for reports (in memory) | Reports are the heaviest queries; Redis only becomes worthwhile with several instances. |
| Data-protection keys in PostgreSQL | Cookies and reset tokens survive restarts and work across instances. |
| Enums stored as strings | The data stays readable in SQL tools and survives enum reordering. |

## Roles

| Role | Can |
| --- | --- |
| Member | Work on projects, tasks and tickets; raise tickets; see their own and assigned tickets |
| Admin | Also manage projects, members, invitations and the helpdesk queue (triage, internal notes); read the audit log |
| Owner | Also manage admins and owners; an organization always keeps at least one owner |
