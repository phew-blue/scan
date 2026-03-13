package server

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
)

const (
	sessionCookie = "scan_session"
	stateCookie   = "scan_state"
	sessionTTL    = 24 * time.Hour
)

type sessionData struct {
	Subject string    `json:"sub"`
	Expires time.Time `json:"exp"`
}

type contextKey string

const userKey contextKey = "user"

func (s *Server) setupOIDC(ctx context.Context) error {
	provider, err := oidc.NewProvider(ctx, s.cfg.OIDCIssuer)
	if err != nil {
		return fmt.Errorf("oidc provider: %w", err)
	}
	s.oidcProvider = provider
	s.oauth2Config = &oauth2.Config{
		ClientID:     s.cfg.OIDCClientID,
		ClientSecret: s.cfg.OIDCClientSecret,
		RedirectURL:  s.cfg.OIDCRedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
	return nil
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil || cookie.Value == "" {
			http.Redirect(w, r, "/auth/login", http.StatusFound)
			return
		}

		sess, err := verifySession(cookie.Value, s.cfg.SessionSecret)
		if err != nil || time.Now().After(sess.Expires) {
			http.SetCookie(w, &http.Cookie{Name: sessionCookie, MaxAge: -1, Path: "/"})
			http.Redirect(w, r, "/auth/login", http.StatusFound)
			return
		}

		ctx := context.WithValue(r.Context(), userKey, sess.Subject)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

var loginTmpl = template.Must(template.New("login").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Sign in — Scan</title>
<style>
  :root { --bg:#080c0f; --surface:#0f1519; --border:#1e2d35; --accent:#00aaff; --accent-dim:#003d5c; --text:#e8eef2; --text-dim:#5a7a8a; --red:#ff4444; }
  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { font-family:'IBM Plex Mono',monospace; background:var(--bg); color:var(--text); min-height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; }
  .card { width:100%; max-width:360px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:32px 24px; display:flex; flex-direction:column; gap:24px; }
  .logo { display:flex; align-items:center; justify-content:center; gap:10px; }
  .logo img { width:32px; height:32px; }
  .logo span { font-size:14px; font-weight:600; letter-spacing:.08em; color:var(--accent); }
  .divider { display:flex; align-items:center; gap:12px; color:var(--text-dim); font-size:11px; letter-spacing:.1em; }
  .divider::before, .divider::after { content:''; flex:1; height:1px; background:var(--border); }
  .btn { width:100%; padding:14px; border-radius:8px; font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600; letter-spacing:.08em; cursor:pointer; border:1px solid; transition:opacity .15s; }
  .btn-oidc { background:var(--accent-dim); border-color:var(--accent); color:var(--accent); }
  .btn-submit { background:var(--accent); border-color:var(--accent); color:#000; }
  .btn:disabled { opacity:.4; cursor:not-allowed; }
  input[type=password] { width:100%; padding:14px; background:var(--bg); border:1px solid var(--border); border-radius:8px; color:var(--text); font-family:'IBM Plex Mono',monospace; font-size:16px; outline:none; }
  input[type=password]:focus { border-color:var(--accent); }
  .error { color:var(--red); font-size:12px; letter-spacing:.04em; }
  .form { display:flex; flex-direction:column; gap:10px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <img src="/logo.svg" alt="">
    <span>BARCODE SCANNER</span>
  </div>
  {{if .HasOIDC}}
  <a href="/auth/oidc" class="btn btn-oidc" style="text-decoration:none;text-align:center;display:block">SIGN IN WITH AUTHELIA</a>
  {{end}}
  {{if .HasPassword}}
  {{if .HasOIDC}}<div class="divider">OR</div>{{end}}
  <form class="form" method="POST" action="/auth/password">
    <input type="hidden" name="csrf_token" value="{{.CSRFToken}}">
    <input type="password" name="password" placeholder="Enter password" autofocus autocomplete="current-password">
    {{if .Error}}<p class="error">{{.Error}}</p>{{end}}
    <button type="submit" class="btn btn-submit">SIGN IN</button>
  </form>
  {{end}}
</div>
</body>
</html>`))

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	hasOIDC := s.oauth2Config != nil
	hasPassword := s.cfg.AccessPassword != ""

	if hasOIDC && !hasPassword {
		s.handleOIDCRedirect(w, r)
		return
	}

	csrfToken, err := randomString(32)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "scan_csrf",
		Value:    csrfToken,
		Path:     "/",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	loginTmpl.Execute(w, map[string]any{ //nolint:errcheck
		"HasOIDC":     hasOIDC,
		"HasPassword": hasPassword,
		"Error":       r.URL.Query().Get("error"),
		"CSRFToken":   csrfToken,
	})
}

func (s *Server) handleOIDCRedirect(w http.ResponseWriter, r *http.Request) {
	state, err := randomString(32)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, s.oauth2Config.AuthCodeURL(state), http.StatusFound)
}

func (s *Server) initAccessPassword() {
	if s.cfg.AccessPassword == "" {
		return
	}
	if strings.HasPrefix(s.cfg.AccessPassword, "$2") {
		return // already a bcrypt hash
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(s.cfg.AccessPassword), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("failed to hash access password", "err", err)
		return
	}
	slog.Warn("SCAN_ACCESS_PASSWORD is stored as plaintext — consider storing the bcrypt hash instead")
	s.cfg.AccessPassword = string(hash)
}

func (s *Server) handlePasswordLogin(w http.ResponseWriter, r *http.Request) {
	ip := realIP(r)
	if !s.limiter.allow(ip) {
		authFailuresTotal.WithLabelValues("password").Inc()
		http.Redirect(w, r, "/auth/login?error=too+many+attempts,+try+again+later", http.StatusFound)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/auth/login?error=invalid+request", http.StatusFound)
		return
	}
	// CSRF check
	csrfCookie, err := r.Cookie("scan_csrf")
	if err != nil || r.FormValue("csrf_token") == "" || csrfCookie.Value != r.FormValue("csrf_token") {
		http.Redirect(w, r, "/auth/login?error=invalid+request", http.StatusFound)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "scan_csrf", MaxAge: -1, Path: "/"})

	provided := r.FormValue("password")
	if err := bcrypt.CompareHashAndPassword([]byte(s.cfg.AccessPassword), []byte(provided)); err != nil {
		authFailuresTotal.WithLabelValues("password").Inc()
		slog.Warn("failed password login attempt", "ip", ip)
		http.Redirect(w, r, "/auth/login?error=incorrect+password", http.StatusFound)
		return
	}

	sess := sessionData{Subject: "guest", Expires: time.Now().Add(sessionTTL)}
	signed, err := signSession(sess, s.cfg.SessionSecret)
	if err != nil {
		http.Error(w, "session error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    signed,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/", http.StatusFound)
}

func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	stateCook, err := r.Cookie(stateCookie)
	if err != nil || r.URL.Query().Get("state") != stateCook.Value {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: stateCookie, MaxAge: -1, Path: "/"})

	token, err := s.oauth2Config.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		slog.Error("token exchange failed", "err", err)
		http.Error(w, "auth failed", http.StatusInternalServerError)
		return
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		http.Error(w, "no id_token", http.StatusInternalServerError)
		return
	}

	verifier := s.oidcProvider.Verifier(&oidc.Config{ClientID: s.cfg.OIDCClientID})
	idToken, err := verifier.Verify(r.Context(), rawIDToken)
	if err != nil {
		http.Error(w, "token verification failed", http.StatusInternalServerError)
		return
	}

	sess := sessionData{Subject: idToken.Subject, Expires: time.Now().Add(sessionTTL)}
	signed, err := signSession(sess, s.cfg.SessionSecret)
	if err != nil {
		http.Error(w, "session error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    signed,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	// Use a client-side redirect instead of HTTP 302 so Safari's ITP does not
	// block the session cookie set during the cross-site OIDC redirect chain.
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"><title>Redirecting…</title></head><body><script>window.location.replace("/")</script></body></html>`) //nolint:errcheck
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, MaxAge: -1, Path: "/"})
	http.Redirect(w, r, "/", http.StatusFound)
}

func signSession(data sessionData, secret string) (string, error) {
	payload, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	encoded := base64.URLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(encoded))
	sig := base64.URLEncoding.EncodeToString(mac.Sum(nil))
	return encoded + "." + sig, nil
}

func verifySession(token, secret string) (*sessionData, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0]))
	expected := base64.URLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expected)) {
		return nil, fmt.Errorf("invalid signature")
	}
	payload, err := base64.URLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}
	var sess sessionData
	if err := json.Unmarshal(payload, &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b)[:n], nil
}
