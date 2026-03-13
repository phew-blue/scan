package server

import (
	"testing"
	"time"
)

func TestSignAndVerifySession(t *testing.T) {
	secret := "test-secret-32-bytes-long-enough"
	sess := sessionData{
		Subject: "user123",
		Expires: time.Now().Add(time.Hour),
	}

	token, err := signSession(sess, secret)
	if err != nil {
		t.Fatalf("signSession: %v", err)
	}

	got, err := verifySession(token, secret)
	if err != nil {
		t.Fatalf("verifySession: %v", err)
	}
	if got.Subject != sess.Subject {
		t.Errorf("subject: got %q, want %q", got.Subject, sess.Subject)
	}
}

func TestVerifySession_WrongSecret(t *testing.T) {
	token, err := signSession(sessionData{Subject: "u", Expires: time.Now().Add(time.Hour)}, "secret-a")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := verifySession(token, "secret-b"); err == nil {
		t.Error("expected error with wrong secret, got nil")
	}
}

func TestVerifySession_TamperedPayload(t *testing.T) {
	token, err := signSession(sessionData{Subject: "u", Expires: time.Now().Add(time.Hour)}, "secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := verifySession(token+"x", "secret"); err == nil {
		t.Error("expected error with tampered token, got nil")
	}
}

func TestVerifySession_InvalidFormat(t *testing.T) {
	if _, err := verifySession("no-dot-separator", "secret"); err == nil {
		t.Error("expected error for token without dot separator, got nil")
	}
}

func TestVerifySession_ExpiredIsNotChecked(t *testing.T) {
	// verifySession only checks the signature — expiry is the caller's responsibility.
	sess := sessionData{Subject: "u", Expires: time.Now().Add(-time.Hour)}
	token, err := signSession(sess, "secret")
	if err != nil {
		t.Fatal(err)
	}
	got, err := verifySession(token, "secret")
	if err != nil {
		t.Fatalf("verifySession rejected an expired-but-valid token: %v", err)
	}
	if !got.Expires.Before(time.Now()) {
		t.Error("expected session to be expired")
	}
}
