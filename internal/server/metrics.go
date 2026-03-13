package server

import (
	"context"
	"time"

	"github.com/phew-blue/scan/internal/db"
	"github.com/prometheus/client_golang/prometheus"
)

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

// dbStatsCollector exposes live DB row counts as Prometheus gauges.
// It is registered once per server instance in New().
type dbStatsCollector struct {
	store     *db.Store
	jobsDesc  *prometheus.Desc
	scansDesc *prometheus.Desc
}

func newDBStatsCollector(store *db.Store) *dbStatsCollector {
	return &dbStatsCollector{
		store: store,
		jobsDesc: prometheus.NewDesc(
			"scan_db_jobs_total",
			"Current number of jobs in the database.",
			nil, nil,
		),
		scansDesc: prometheus.NewDesc(
			"scan_db_scans_total",
			"Current number of scans in the database, partitioned by validity.",
			[]string{"valid"}, nil,
		),
	}
}

func (c *dbStatsCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.jobsDesc
	ch <- c.scansDesc
}

func (c *dbStatsCollector) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stats, err := c.store.GetStats(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.jobsDesc, err)
		ch <- prometheus.NewInvalidMetric(c.scansDesc, err)
		return
	}

	ch <- prometheus.MustNewConstMetric(c.jobsDesc, prometheus.GaugeValue, float64(stats.Jobs))
	ch <- prometheus.MustNewConstMetric(c.scansDesc, prometheus.GaugeValue, float64(stats.ValidScans), "true")
	ch <- prometheus.MustNewConstMetric(c.scansDesc, prometheus.GaugeValue, float64(stats.InvalidScans), "false")
}
