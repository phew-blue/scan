package server

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/phew-blue/scan/internal/config"
	"github.com/phew-blue/scan/internal/db"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"golang.org/x/oauth2"
)

type Server struct {
	cfg          *config.Config
	store        *db.Store
	oidcProvider *oidc.Provider
	oauth2Config *oauth2.Config
	limiter      *ipLimiter
}

func New(cfg *config.Config, store *db.Store) http.Handler {
	s := &Server{cfg: cfg, store: store}

	if err := s.setupOIDC(context.Background()); err != nil {
		slog.Error("failed to setup OIDC", "err", err)
		os.Exit(1)
	}

	s.initValidation()
	s.initAccessPassword()
	s.limiter = newIPLimiter()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(securityHeaders)

	// Metrics endpoint (public, no auth)
	r.Get("/metrics", promhttp.Handler().ServeHTTP)

	// Auth routes (public)
	r.Get("/auth/login", s.handleLogin)
	r.Get("/auth/oidc", s.handleOIDCRedirect)
	r.Post("/auth/password", s.handlePasswordLogin)
	r.Get("/auth/callback", s.handleCallback)
	r.Post("/auth/logout", s.handleLogout)

	// API routes (protected)
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		r.Get("/api/jobs", s.handleListJobs)
		r.Post("/api/jobs", s.handleCreateJob)
		r.Get("/api/jobs/{id}", s.handleGetJob)
		r.Delete("/api/jobs/{id}", s.handleDeleteJob)
		r.Post("/api/jobs/{id}/scans", s.handleAddScan)
		r.Delete("/api/jobs/{id}/scans/{scanId}", s.handleDeleteScan)
		r.Post("/api/jobs/{id}/patterns", s.handleAddJobPattern)
		r.Delete("/api/jobs/{id}/patterns/{patternId}", s.handleRemoveJobPattern)

		r.Get("/api/patterns", s.handleListPatterns)
		r.Post("/api/patterns", s.handleCreatePattern)
		r.Patch("/api/patterns/{id}", s.handleSetPatternDefault)
		r.Delete("/api/patterns/{id}", s.handleDeletePattern)
	})

	// Serve Next.js static export
	staticFS := os.DirFS(cfg.StaticDir)
	fileServer := http.FileServer(http.FS(staticFS))

	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			stripped := strings.TrimPrefix(r.URL.Path, "/")
			if stripped == "" {
				r.URL.Path = "/index.html"
			} else {
				info, err := fs.Stat(staticFS, stripped)
				if err != nil {
					// File not found — try as a Next.js page dir (trailingSlash: true → path/index.html)
					if _, err2 := fs.Stat(staticFS, stripped+"/index.html"); err2 == nil {
						r.URL.Path = "/" + stripped + "/index.html"
					} else {
						r.URL.Path = "/"
					}
				} else if info.IsDir() {
					// Serve index.html directly — avoids FileServer's 301 redirect that Safari rejects
					r.URL.Path = "/" + strings.TrimSuffix(stripped, "/") + "/index.html"
				}
			}
			fileServer.ServeHTTP(w, r)
		})
	})

	return r
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(self), microphone=()")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		next.ServeHTTP(w, r)
	})
}
