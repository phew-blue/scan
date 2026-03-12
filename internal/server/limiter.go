package server

import (
	"net/http"
	"sync"
	"time"
)

const (
	limitMax    = 5
	limitWindow = 10 * time.Minute
	lockoutDur  = 30 * time.Minute
)

type entry struct {
	count       int
	windowStart time.Time
	lockedUntil time.Time
}

type ipLimiter struct {
	mu      sync.Mutex
	entries map[string]*entry
}

func newIPLimiter() *ipLimiter {
	l := &ipLimiter{entries: make(map[string]*entry)}
	go l.cleanup()
	return l
}

func (l *ipLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	e, ok := l.entries[ip]
	if !ok {
		e = &entry{windowStart: now}
		l.entries[ip] = e
	}
	if now.Before(e.lockedUntil) {
		return false
	}
	if now.After(e.windowStart.Add(limitWindow)) {
		e.count = 0
		e.windowStart = now
	}
	e.count++
	if e.count > limitMax {
		e.lockedUntil = now.Add(lockoutDur)
		return false
	}
	return true
}

func (l *ipLimiter) cleanup() {
	for range time.Tick(time.Hour) {
		l.mu.Lock()
		now := time.Now()
		for ip, e := range l.entries {
			if now.After(e.lockedUntil) && now.After(e.windowStart.Add(limitWindow)) {
				delete(l.entries, ip)
			}
		}
		l.mu.Unlock()
	}
}

func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}
