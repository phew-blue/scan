package server

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
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

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
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
	http.Redirect(w, r, "/", http.StatusFound)
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
