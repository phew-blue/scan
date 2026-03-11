package db

import (
	"context"
	"embed"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Store struct {
	pool *pgxpool.Pool
}

type Job struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	ScanCount int       `json:"scan_count,omitempty"`
}

type Scan struct {
	ID        uuid.UUID `json:"id"`
	JobID     uuid.UUID `json:"job_id"`
	Barcode   string    `json:"barcode"`
	Valid     bool      `json:"valid"`
	ScannedAt time.Time `json:"scanned_at"`
}

type JobWithScans struct {
	Job
	Scans []Scan `json:"scans"`
}

func New(ctx context.Context, dbURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Migrate() error {
	db := stdlib.OpenDBFromPool(s.pool)
	defer db.Close()

	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}
	return nil
}

func (s *Store) CreateJob(ctx context.Context, title string) (Job, error) {
	var j Job
	err := s.pool.QueryRow(ctx,
		`INSERT INTO jobs (id, title, created_at) VALUES (gen_random_uuid(), $1, now()) RETURNING id, title, created_at`,
		title,
	).Scan(&j.ID, &j.Title, &j.CreatedAt)
	return j, err
}

func (s *Store) ListJobs(ctx context.Context) ([]Job, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT j.id, j.title, j.created_at, COUNT(s.id) AS scan_count
		 FROM jobs j
		 LEFT JOIN scans s ON s.job_id = j.id
		 GROUP BY j.id
		 ORDER BY j.created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		var j Job
		if err := rows.Scan(&j.ID, &j.Title, &j.CreatedAt, &j.ScanCount); err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	if jobs == nil {
		jobs = []Job{}
	}
	return jobs, rows.Err()
}

func (s *Store) GetJob(ctx context.Context, id uuid.UUID) (*JobWithScans, error) {
	var j JobWithScans
	err := s.pool.QueryRow(ctx,
		`SELECT id, title, created_at FROM jobs WHERE id = $1`, id,
	).Scan(&j.ID, &j.Title, &j.CreatedAt)
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT id, job_id, barcode, valid, scanned_at FROM scans WHERE job_id = $1 ORDER BY scanned_at ASC`,
		id,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	j.Scans = []Scan{}
	for rows.Next() {
		var sc Scan
		if err := rows.Scan(&sc.ID, &sc.JobID, &sc.Barcode, &sc.Valid, &sc.ScannedAt); err != nil {
			return nil, err
		}
		j.Scans = append(j.Scans, sc)
	}
	return &j, rows.Err()
}

func (s *Store) DeleteJob(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM jobs WHERE id = $1`, id)
	return err
}

func (s *Store) AddScan(ctx context.Context, jobID uuid.UUID, barcode string, valid bool) (Scan, error) {
	var sc Scan
	err := s.pool.QueryRow(ctx,
		`INSERT INTO scans (id, job_id, barcode, valid, scanned_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, now())
		 RETURNING id, job_id, barcode, valid, scanned_at`,
		jobID, barcode, valid,
	).Scan(&sc.ID, &sc.JobID, &sc.Barcode, &sc.Valid, &sc.ScannedAt)
	return sc, err
}

func (s *Store) DeleteScan(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM scans WHERE id = $1`, id)
	return err
}

