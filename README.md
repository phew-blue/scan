<p align="center">
  <img src="frontend/public/logo.svg" width="120" alt="scan" />
</p>

# Scan

A barcode scanning app for tracking jobs. Scan barcodes into jobs, manage job lists, and export results — with OIDC authentication and a Next.js frontend.

---

## Features

- **Jobs** — create named jobs and scan barcodes into them
- **Barcode validation** — configurable per-job regex patterns; jobs with no patterns accept all barcodes
- **OIDC auth** — login via any OpenID Connect provider (Authelia, etc.)
- **Access password** — optional password gate before OIDC login (brute-force rate-limited per IP)
- **Camera scanner** — in-browser barcode scanning via device camera with audio beep on scan
- **HID scanner** — keyboard-input support for USB barcode scanners
- **Prometheus metrics** — `/metrics` endpoint with auth failure alerting and scan/job counters
- **Self-contained** — single binary serving the Next.js frontend as static files

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Backend  | Go + Chi router                         |
| Database | PostgreSQL (pgx + goose migrations)     |
| Auth     | OIDC (Authelia) + optional access password |
| Frontend | Next.js + TailwindCSS (static export)   |
| Tests    | Go `testing` + Vitest (frontend)        |
| Secrets  | ExternalSecrets + 1Password             |

## Development

### Prerequisites

- Go 1.25+
- Node.js 24+
- pnpm
- Docker + Docker Compose

### Local setup

```bash
# Start Postgres
docker compose up -d postgres

# Run the app
docker compose up app
```

Or run directly:

```bash
# Frontend dev server
cd frontend && pnpm install && pnpm dev

# Backend (separate terminal)
export SCAN_DB_HOST=localhost SCAN_DB_PASSWORD=scan \
       SCAN_OIDC_ISSUER=https://auth.example.com \
       SCAN_OIDC_CLIENT_ID=scan SCAN_OIDC_CLIENT_SECRET=changeme \
       SCAN_OIDC_REDIRECT_URL=http://localhost:8080/auth/callback \
       SCAN_SESSION_SECRET=changeme-at-least-32-chars-long
go run ./cmd/scan
```

### Running tests

```bash
# Backend
go test ./...

# Frontend
cd frontend && pnpm test
```

### Configuration

All settings are environment variables:

| Variable                  | Default          | Description                                    |
|---------------------------|------------------|------------------------------------------------|
| `SCAN_PORT`               | `8080`           | HTTP port                                      |
| `SCAN_DB_HOST`            | *(required)*     | Postgres host                                  |
| `SCAN_DB_PORT`            | `5432`           | Postgres port                                  |
| `SCAN_DB_NAME`            | `scan`           | Postgres database name                         |
| `SCAN_DB_USER`            | `scan`           | Postgres user                                  |
| `SCAN_DB_PASSWORD`        | *(required)*     | Postgres password                              |
| `SCAN_OIDC_ISSUER`        | *(required)*     | OIDC provider URL                              |
| `SCAN_OIDC_CLIENT_ID`     | *(required)*     | OIDC client ID                                 |
| `SCAN_OIDC_CLIENT_SECRET` | *(required)*     | OIDC client secret                             |
| `SCAN_OIDC_REDIRECT_URL`  | *(required)*     | OIDC redirect URL                              |
| `SCAN_SESSION_SECRET`     | *(required)*     | Secret for signing session cookies (min 32 chars) |
| `SCAN_ACCESS_PASSWORD`    | *(none)*         | Optional password gate before OIDC login       |
| `SCAN_STATIC_DIR`         | `./frontend/out` | Path to Next.js static output                  |

### Prometheus metrics

| Metric                        | Type    | Labels              | Description                          |
|-------------------------------|---------|---------------------|--------------------------------------|
| `scan_auth_failures_total`    | Counter | `method`            | Failed authentication attempts       |
| `scan_scans_total`            | Counter | `job_title`, `valid`| Barcodes scanned, by job and validity|
| `scan_jobs_created_total`     | Counter | —                   | Jobs created                         |

## Deployment

Deployed to the home-ops Kubernetes cluster via Flux:
- **Dev**: `kubernetes/apps/dev/scan/` — auto-deployed on every push to the `dev` branch
- **Production**: `kubernetes/apps/default/scan/` — deployed on tagged releases via `/release`

Both deployments have Prometheus `ServiceMonitor` and Grafana dashboards (in the "Apps" folder) with Stats, Application Metrics, Database, and Logs panels.
