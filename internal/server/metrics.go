package server

import "github.com/prometheus/client_golang/prometheus"

var (
	authFailuresTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scan_auth_failures_total",
			Help: "Total number of failed authentication attempts.",
		},
		[]string{"method"},
	)
)

func init() {
	prometheus.MustRegister(authFailuresTotal)
}
