# Testing DevFlow

| Suite | Where | What it covers | Needs |
| --- | --- | --- | --- |
| API integration tests (xUnit v3) | `apps/api/tests/DevFlow.Api.Tests` | Every endpoint through the real HTTP pipeline against real PostgreSQL: auth, CSRF, lockout, tenant isolation, roles, invitations, tasks (incl. concurrency), tickets, reports, audit log, background jobs, SignalR | PostgreSQL |
| End-to-end (Playwright) | `apps/web/e2e` | User journeys in a browser: auth, onboarding, Kanban drag-and-drop (pointer and keyboard), task details, helpdesk with two simultaneous users and live notifications, isolation, mobile layouts | Running web + API + PostgreSQL |
| Static checks | `apps/web` | ESLint, TypeScript, production build | — |

## API tests

Each test run creates a throwaway database (`devflow_test_<guid>`), applies the migrations and
drops it afterwards. Point the tests at a PostgreSQL server whose role may create databases:

```bash
cd apps/api
dotnet user-secrets set "ConnectionStrings:DevFlowTest" \
  "Host=localhost;Port=5432;Database=postgres;Username=devflow;Password=<password>" \
  --project tests/DevFlow.Api.Tests
# the role needs:  ALTER ROLE devflow CREATEDB;
dotnet test
```

In CI the same setting comes from the `ConnectionStrings__DevFlowTest` environment variable.
Time-based logic (job thresholds, expiry) uses an injected `TimeProvider`; tests swap in
`FakeTimeProvider` and advance it instead of waiting.

## End-to-end tests

Start the API in Development (the tests read password-reset and invitation emails from the dev
mailbox) and the web app, then:

```bash
cd apps/web
npx playwright install chromium        # once; or set PW_CHANNEL=msedge / chrome to use an installed browser
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

Tests create their own users and workspaces, so they can run repeatedly against the same database.
