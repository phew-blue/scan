# CLAUDE.md

This file provides guidance to Claude Code when working in the scan repository.

## Overview

Scan is a barcode scanning app for tracking jobs. Users create named jobs and scan barcodes into them. Authentication is via OIDC. A Go binary serves both the REST API and the Next.js frontend as static files.

## Tech Stack

- **Backend**: Go + Chi router
- **Database**: PostgreSQL — pgx driver, sqlc for type-safe queries, goose for migrations
- **Auth**: OIDC (`go-oidc` + `oauth2`) with optional access password gate
- **Frontend**: Next.js + TailwindCSS (static export served by Go)
- **Metrics**: Prometheus (`/metrics` endpoint, brute-force alerting)
- **Secrets**: ExternalSecrets + 1Password

## Directory Structure

```
cmd/scan/          # main entrypoint
internal/
  config/          # envconfig-based configuration (SCAN_ prefix)
  db/              # pgx store, sqlc queries, goose migrations
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

# Run tests
go test ./...

# Frontend dev server
cd frontend && pnpm install && pnpm dev

# After dependency changes, sync go.mod
go mod tidy
```

## API Routes

All API routes require authentication (session cookie from OIDC login).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs` | List all jobs |
| `POST` | `/api/jobs` | Create a job |
| `GET` | `/api/jobs/{id}` | Get a job |
| `DELETE` | `/api/jobs/{id}` | Delete a job |
| `POST` | `/api/jobs/{id}/scans` | Add a barcode scan to a job |
| `DELETE` | `/api/jobs/{id}/scans/{scanId}` | Remove a scan |

Auth routes (public): `/auth/login`, `/auth/oidc`, `/auth/password`, `/auth/callback`, `/auth/logout`

Metrics (public): `/metrics`

## Configuration

All variables use the `SCAN_` prefix. See `internal/config/config.go` for the full list.

Key variables:
- `SCAN_DB_HOST` / `SCAN_DB_PASSWORD` — required Postgres connection
- `SCAN_OIDC_ISSUER` / `SCAN_OIDC_CLIENT_ID` / `SCAN_OIDC_CLIENT_SECRET` / `SCAN_OIDC_REDIRECT_URL` — required OIDC config
- `SCAN_ACCESS_PASSWORD` — optional pre-OIDC password gate (brute-force rate limited)
- `SCAN_BARCODE_PATTERN` — regex for barcode validation, default `^TL\d{8}$`
- `SCAN_STATIC_DIR` — path to Next.js static output, default `./frontend/out`
- `SessionSecret` — **always auto-generated**, never read from environment

## Notable Implementation Details

- **Session secret** — generated randomly at startup via `crypto/rand`. Never set `SCAN_SESSION_SECRET` in environment; the field is tagged `ignored:"true"` in the envconfig struct.
- **Frontend static export** — Next.js builds to `frontend/out/`. The Go server falls back to `index.html` for unknown paths to support client-side routing.
- **Barcode validation** — pattern compiled once in `server.initValidation()` from `cfg.BarcodePattern`.
- **Access password** — rate-limited per IP via token bucket (`internal/server/limiter.go`). Prometheus counter incremented on failed attempts.
- **go mod tidy** — run after any dependency version bump (Renovate updates may leave go.mod/go.sum out of sync without it).

## Commit Message Guide

Format: `type(scope): description` — no Co-Authored-By lines.

```
feat(server): add export endpoint
fix(config): remove required tag from session secret
feat(frontend): add job search filter
chore(deps): update go dependencies
```

Valid scopes: `server`, `config`, `db`, `frontend`, `docker`, `ci`, `docs`, `deps`
