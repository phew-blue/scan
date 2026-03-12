# ── Stage 1: Build Next.js frontend ──────────────────────────────────────────
FROM node:24-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
ARG NEXT_PUBLIC_APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
RUN pnpm run build

# ── Stage 2: Build Go binary ──────────────────────────────────────────────────
FROM golang:1.23-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG BUILD_VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -X github.com/phew-blue/scan/internal/version.Version=${BUILD_VERSION}" \
    -o scan ./cmd/scan

# ── Stage 3: Final image ──────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=go-builder /app/scan ./scan
COPY --from=frontend-builder /app/frontend/out ./frontend/out

EXPOSE 8080
USER nonroot
CMD ["/app/scan"]
