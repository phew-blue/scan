package server

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"os"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/phew-blue/scan/internal/config"
	"github.com/phew-blue/scan/internal/db"
	"golang.org/x/oauth2"
)

type Server struct {
	cfg          *config.Config
	store        *db.Store
	oidcProvider *oidc.Provider
	oauth2Config *oauth2.Config
}

func New(cfg *config.Config, store *db.Store) http.Handler {
	s := &Server{cfg: cfg, store: store}

	if err := s.setupOIDC(context.Background()); err != nil {
		slog.Error("failed to setup OIDC", "err", err)
		os.Exit(1)
	}

	s.initValidation()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	// Auth routes (public)
	r.Get("/auth/login", s.handleLogin)
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
	})

	// Serve Next.js static export
	staticFS := os.DirFS(cfg.StaticDir)
	fileServer := http.FileServer(http.FS(staticFS))

	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Try the requested path, fall back to index.html for client-side routing
			path := r.URL.Path
			if path == "/" {
				path = "/index.html"
			}
			if _, err := fs.Stat(staticFS, path[1:]); err != nil {
				r.URL.Path = "/"
			}
			fileServer.ServeHTTP(w, r)
		})
	})

	return r
}
