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

	scansTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scan_scans_total",
			Help: "Total number of barcodes scanned, partitioned by job and validity.",
		},
		[]string{"job_title", "valid"},
	)

	jobsCreatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "scan_jobs_created_total",
			Help: "Total number of scan jobs created.",
		},
	)
)

func init() {
	prometheus.MustRegister(authFailuresTotal, scansTotal, jobsCreatedTotal)
}
