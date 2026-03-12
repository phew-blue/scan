<p align="center">
  <img src="frontend/public/logo.svg" width="120" alt="scan" />
</p>

# Scan

A barcode scanning app for tracking jobs. Scan barcodes into jobs, manage job lists, and export results — with OIDC authentication and a Next.js frontend.

---

## Features

- **Jobs** — create named jobs and scan barcodes into them
- **Barcode validation** — configurable pattern (default `^TL\d{8}$`)
- **OIDC auth** — login via any OpenID Connect provider (Authelia, etc.)
- **Access password** — optional password gate before OIDC login
- **Prometheus metrics** — built-in `/metrics` endpoint with brute-force alerting
- **Self-contained** — single binary serving the Next.js frontend as static files

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Go + Chi router                   |
| Database | PostgreSQL (pgx + sqlc + goose)   |
| Auth     | OIDC (Authelia)                   |
| Frontend | Next.js + TailwindCSS             |
| Secrets  | ExternalSecrets + 1Password       |

## Development

### Prerequisites

- Go 1.26+
- Node.js 24+
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
# Frontend
cd frontend && pnpm install && pnpm dev

# Backend (separate terminal)
export SCAN_DB_HOST=localhost SCAN_DB_PASSWORD=scan \
       SCAN_OIDC_ISSUER=https://auth.example.com \
       SCAN_OIDC_CLIENT_ID=scan SCAN_OIDC_CLIENT_SECRET=changeme \
       SCAN_OIDC_REDIRECT_URL=http://localhost:8080/auth/callback
go run ./cmd/scan
```

### Configuration

All settings are environment variables:

| Variable                | Default              | Description                          |
|-------------------------|----------------------|--------------------------------------|
| `SCAN_PORT`             | `8080`               | HTTP port                            |
| `SCAN_DB_HOST`          | *(required)*         | Postgres host                        |
| `SCAN_DB_PORT`          | `5432`               | Postgres port                        |
| `SCAN_DB_NAME`          | `scan`               | Postgres database name               |
| `SCAN_DB_USER`          | `scan`               | Postgres user                        |
| `SCAN_DB_PASSWORD`      | *(required)*         | Postgres password                    |
| `SCAN_OIDC_ISSUER`      | *(required)*         | OIDC provider URL                    |
| `SCAN_OIDC_CLIENT_ID`   | *(required)*         | OIDC client ID                       |
| `SCAN_OIDC_CLIENT_SECRET` | *(required)*       | OIDC client secret                   |
| `SCAN_OIDC_REDIRECT_URL` | *(required)*        | OIDC redirect URL                    |
| `SCAN_ACCESS_PASSWORD`  | *(none)*             | Optional password gate before login  |
| `SCAN_BARCODE_PATTERN`  | `^TL\d{8}$`          | Regex pattern for barcode validation |
| `SCAN_STATIC_DIR`       | `./frontend/out`     | Path to Next.js static output        |

## Deployment

Deployed to the home-ops Kubernetes cluster via Flux. Manifests in `kubernetes/apps/dev/scan/` (dev) and `kubernetes/apps/default/scan/` (production).
