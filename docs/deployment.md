# Deploying DevFlow

DevFlow ships as three container images plus a PostgreSQL database:

| Image | Built from | Purpose |
| --- | --- | --- |
| `devflow-api` | `apps/api` (target `runtime`) | ASP.NET Core API on port 8080, non-root |
| `devflow-migrator` | `apps/api` (target `migrator`) | Applies EF Core migrations, then exits |
| `devflow-web` | `apps/web` (build arg `API_BASE_URL`) | Next.js standalone server on port 3000, non-root |

Only **web** is exposed to the internet. The browser talks to the web app, which proxies `/api/*`
and `/hubs/*` to the API over the private network, so cookies stay first-party and no CORS is needed.

```text
Internet ──HTTPS──► load balancer / ingress ──► web :3000 ──► api :8080 ──► PostgreSQL
                    (TLS terminates here)        (private)     (private)
```

## Recommended target: Azure

Any container platform works (AWS ECS/App Runner, Google Cloud Run, Kubernetes, a VM with
Docker Compose). On Azure the managed equivalents are:

| Need | Azure service |
| --- | --- |
| Run the containers | **Azure Container Apps** (one environment, three apps: web external, api internal, migrator as a Container Apps *Job*) |
| Database | **Azure Database for PostgreSQL – Flexible Server** (v17), private access or firewall to the Container Apps environment |
| Images | **Azure Container Registry** |
| Secrets | **Key Vault** referenced from Container Apps secrets |
| Email | **Azure Communication Services** SMTP relay (or SendGrid/SES) |
| Logs | Log Analytics (the API writes JSON logs in Production) |

### Steps

1. **Build and push images** (CI can do this; see "Publishing from CI" below):

   ```bash
   az acr login --name <registry>
   docker build -t <registry>.azurecr.io/devflow-api:<version> --target runtime apps/api
   docker build -t <registry>.azurecr.io/devflow-migrator:<version> --target migrator apps/api
   docker build -t <registry>.azurecr.io/devflow-web:<version> \
     --build-arg API_BASE_URL=http://devflow-api apps/web
   docker push <registry>.azurecr.io/devflow-api:<version>   # …and the other two
   ```

   `API_BASE_URL` is baked into the web image at build time (Next.js resolves rewrites during
   `next build`). Use the API app's **internal** address inside the Container Apps environment.

2. **Create the database** (Flexible Server, PostgreSQL 17) with a dedicated login role for the
   app that owns the `devflow` database. Store its connection string in Key Vault.

3. **Run migrations** with the migrator job on every release, *before* rolling out the new API:

   ```bash
   az containerapp job start --name devflow-migrator --resource-group <rg>
   ```

4. **Deploy the API** (internal ingress, target port 8080) with these settings:

   | Setting | Value |
   | --- | --- |
   | `ConnectionStrings__DevFlow` | secret: the PostgreSQL connection string (add `SSL Mode=Require`) |
   | `App__WebBaseUrl` | `https://devflow.example.com` (used in emailed links) |
   | `Proxy__TrustedNetworks__0` | the Container Apps environment's subnet CIDR |
   | `Email__SmtpHost`, `Email__SmtpPort`, `Email__SmtpUsername`, `Email__SmtpPassword` (secret), `Email__FromAddress` | your SMTP relay |
   | `Security__AuthAttemptsPerMinute` | optional; defaults to 10 per IP |

   Probes: **liveness** `GET /api/v1/health/live`, **readiness** `GET /api/v1/health`.

5. **Deploy the web app** (external ingress, target port 3000, HTTPS only, custom domain with a
   managed certificate). It needs no secrets.

6. **Smoke test**: open `https://<domain>/status` (all green), register, create a workspace.

## Production checklist

- [ ] HTTPS enforced at the ingress; HTTP redirected. (The API sends HSTS on HTTPS responses.)
- [ ] Database not publicly reachable; TLS required; automated backups and point-in-time restore on.
- [ ] Connection strings and SMTP password only in Key Vault / platform secrets, never in images.
- [ ] `Proxy__TrustedNetworks` set to the real proxy subnet (rate limiting and audit IPs depend on it).
- [ ] Email delivery configured, or password reset and invitations will not reach users.
- [ ] Migrations run before each API rollout (the API never migrates on startup).
- [ ] Alerts on readiness failures and on 5xx rate.

## Scaling out (more than one API instance)

What already works across instances:

- **Sessions, CSRF and reset tokens.** Data-protection keys are stored in PostgreSQL
  (`data_protection_keys`), so every instance can read every cookie and survives redeploys.
- **Background jobs** are written to be safe when several instances run them.

What to add when you scale beyond one instance:

- **SignalR backplane.** Real-time notifications are delivered by the instance a user is connected
  to. Add **Azure SignalR Service** (`AddAzureSignalR()`) or a Redis backplane
  (`AddStackExchangeRedis()`) so any instance can reach any user.
- **Shared cache.** Reports use `HybridCache` in memory (1-minute entries). Add a Redis L2 cache
  (`AddStackExchangeRedisCache`) and HybridCache uses it automatically.
- **Rate limiting** is per instance; for a strict global limit put it at the gateway instead.

Redis is deliberately not part of the single-instance deployment: it would add an extra service
without solving a problem DevFlow has at that size.

## Publishing from CI

`.github/workflows/ci.yml` already builds all three images on every push to verify the
Dockerfiles. To publish, add a job on `main` that logs in to your registry
(`azure/login` + `az acr login`, using OIDC federated credentials rather than stored passwords)
and runs `docker/build-push-action` with `push: true`, then starts the migrator job and updates
the container apps to the new tag.
