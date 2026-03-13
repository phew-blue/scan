# CLAUDE.md

This file provides guidance to Claude Code when working in the scan repository.

## Overview

Scan is a barcode scanning app for tracking jobs. Users create named jobs and scan barcodes into them. Authentication is via OIDC. A Go binary serves both the REST API and the Next.js frontend as static files.

## Tech Stack

- **Backend**: Go + Chi router
- **Database**: PostgreSQL — pgx driver, goose for migrations
- **Auth**: OIDC (`go-oidc` + `oauth2`) with optional access password gate (rate-limited per IP)
- **Frontend**: Next.js + TailwindCSS (static export served by Go)
- **Metrics**: Prometheus (`/metrics` endpoint — auth failures, scan counts, job counts)
- **Tests**: Go `testing` package (backend), Vitest (frontend)
- **Secrets**: ExternalSecrets + 1Password

## Directory Structure

```
cmd/scan/          # main entrypoint
internal/
  config/          # envconfig-based configuration (SCAN_ prefix)
  db/              # pgx store, goose migrations
  server/          # Chi router, handlers, auth middleware, metrics
  version/         # build-time version string
frontend/          # Next.js app (pnpm, static export to out/)
```

## Key Commands

```bash
# Start Postgres
docker compose up -d postgres

# Run app (requires env vars — see docker-compose.yaml for defaults)
docker compose up app

# Build backend
go build -o scan ./cmd/scan

# Run backend tests
go test ./...

# Frontend dev server
cd frontend && pnpm install && pnpm dev

# Run frontend tests
cd frontend && pnpm test

# After dependency changes, sync go.mod
go mod tidy
```

## API Routes

All API routes require authentication (session cookie from OIDC login).

| Method   | Path                                    | Description                        |
|----------|-----------------------------------------|------------------------------------|
| `GET`    | `/api/jobs`                             | List all jobs (with scan counts)   |
| `POST`   | `/api/jobs`                             | Create a job                       |
| `GET`    | `/api/jobs/{id}`                        | Get a job with its scans           |
| `DELETE` | `/api/jobs/{id}`                        | Delete a job                       |
| `POST`   | `/api/jobs/{id}/scans`                  | Add a barcode scan to a job        |
| `DELETE` | `/api/jobs/{id}/scans/{scanId}`         | Remove a scan                      |
| `POST`   | `/api/jobs/{id}/patterns`               | Add a validation pattern to a job  |
| `DELETE` | `/api/jobs/{id}/patterns/{patternId}`   | Remove a pattern from a job        |
| `GET`    | `/api/patterns`                         | List global patterns               |
| `POST`   | `/api/patterns`                         | Create a global pattern            |
| `PATCH`  | `/api/patterns/{id}`                    | Set/unset a pattern as default     |
| `DELETE` | `/api/patterns/{id}`                    | Delete a global pattern            |

Auth routes (public): `/auth/login`, `/auth/oidc`, `/auth/password`, `/auth/callback`, `/auth/logout`

Metrics (public): `/metrics`

## Configuration

All variables use the `SCAN_` prefix. See `internal/config/config.go` for the full list.

Key variables:
- `SCAN_DB_HOST` / `SCAN_DB_PASSWORD` — required Postgres connection
- `SCAN_OIDC_ISSUER` / `SCAN_OIDC_CLIENT_ID` / `SCAN_OIDC_CLIENT_SECRET` / `SCAN_OIDC_REDIRECT_URL` — required OIDC config
- `SCAN_SESSION_SECRET` — **required**; signs session cookies; must be at least 32 chars. Store in a secret — losing it invalidates all active sessions.
- `SCAN_ACCESS_PASSWORD` — optional pre-OIDC password gate (brute-force rate limited per IP)
- `SCAN_STATIC_DIR` — path to Next.js static output, default `./frontend/out`

## Notable Implementation Details

- **Session secret** — read from `SCAN_SESSION_SECRET`. Must be set consistently across pod restarts or all sessions will be invalidated on restart.
- **Barcode validation** — per-job, stored in the `patterns` table. Jobs with no patterns accept all barcodes. Patterns marked `is_default` are automatically applied to new jobs. Validation logic is in `server.validateBarcode()`.
- **Frontend static export** — Next.js builds to `frontend/out/`. The Go server uses `http.ServeFileFS` (not `http.FileServer`) to avoid the built-in `301 /index.html → ./` redirect, and falls back to `index.html` for unknown paths.
- **Auth callback** — uses a client-side HTML redirect (`<meta http-equiv="refresh">`) instead of HTTP 302 after OIDC callback, to avoid Safari ITP cookie-blocking in cross-site redirect chains.
- **Camera scanner** — checks `navigator.permissions.query({name: "camera"})` on load; only auto-starts if permission is already granted (avoids prompting on every page load).
- **Audio beep** — Web Audio API square wave at C6 (1046 Hz), 120 ms with exponential fade, played on every successful scan (camera or manual input).
- **Access password** — rate-limited per IP via token bucket (`internal/server/limiter.go`).
- **go mod tidy** — run after any dependency version bump.

## Prometheus Metrics

| Metric                     | Type    | Labels               | Description                            |
|----------------------------|---------|----------------------|----------------------------------------|
| `scan_auth_failures_total` | Counter | `method`             | Failed auth attempts (OIDC / password) |
| `scan_scans_total`         | Counter | `job_title`, `valid` | Barcodes scanned, by job and validity  |
| `scan_jobs_created_total`  | Counter | —                    | Jobs created                           |

Structured log lines are emitted for job creation (`job created`) and each scan (`scan added`), including `job_id`, `job_title`, `barcode`, and `valid` fields — these are queryable in Loki.

## CI / CD

- **`dev` branch** — pushes trigger the `Dev` workflow: runs tests, builds Docker image tagged `dev`, commits the digest to `home-ops` and triggers a Flux reconcile on the dev cluster.
- **`main` / tags** — PRs run lint + type-check + tests. Tag pushes (`v*`) build and push a versioned image, then create a GitHub release. Use `/release <version>` to trigger a release.

## Commit Message Guide

Format: `type(scope): description` — no Co-Authored-By lines.

```
feat(server): add export endpoint
fix(config): remove required tag from session secret
feat(frontend): add job search filter
chore(deps): update go dependencies
```

Valid scopes: `server`, `config`, `db`, `frontend`, `docker`, `ci`, `docs`, `deps`
