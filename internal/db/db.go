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

type Pattern struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Regex     string    `json:"regex"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
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
	Scans    []Scan    `json:"scans"`
	Patterns []Pattern `json:"patterns"`
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

func (s *Store) Pool() *pgxpool.Pool {
	return s.pool
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
	if err != nil {
		return j, err
	}

	// Auto-apply all default patterns to new jobs.
	_, err = s.pool.Exec(ctx,
		`INSERT INTO job_patterns (job_id, pattern_id)
		 SELECT $1, id FROM patterns WHERE is_default = true
		 ON CONFLICT DO NOTHING`,
		j.ID,
	)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}

	patterns, err := s.GetJobPatterns(ctx, id)
	if err != nil {
		return nil, err
	}
	j.Patterns = patterns

	return &j, nil
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

// Pattern methods

func (s *Store) ListPatterns(ctx context.Context) ([]Pattern, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, regex, is_default, created_at FROM patterns ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var patterns []Pattern
	for rows.Next() {
		var p Pattern
		if err := rows.Scan(&p.ID, &p.Name, &p.Regex, &p.IsDefault, &p.CreatedAt); err != nil {
			return nil, err
		}
		patterns = append(patterns, p)
	}
	if patterns == nil {
		patterns = []Pattern{}
	}
	return patterns, rows.Err()
}

func (s *Store) CreatePattern(ctx context.Context, name, regex string) (Pattern, error) {
	var p Pattern
	err := s.pool.QueryRow(ctx,
		`INSERT INTO patterns (id, name, regex, created_at) VALUES (gen_random_uuid(), $1, $2, now()) RETURNING id, name, regex, is_default, created_at`,
		name, regex,
	).Scan(&p.ID, &p.Name, &p.Regex, &p.IsDefault, &p.CreatedAt)
	return p, err
}

func (s *Store) DeletePattern(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM patterns WHERE id = $1`, id)
	return err
}

// Job pattern methods

func (s *Store) GetJobPatterns(ctx context.Context, jobID uuid.UUID) ([]Pattern, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT p.id, p.name, p.regex, p.is_default, p.created_at
		 FROM patterns p
		 JOIN job_patterns jp ON jp.pattern_id = p.id
		 WHERE jp.job_id = $1
		 ORDER BY p.created_at ASC`,
		jobID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var patterns []Pattern
	for rows.Next() {
		var p Pattern
		if err := rows.Scan(&p.ID, &p.Name, &p.Regex, &p.IsDefault, &p.CreatedAt); err != nil {
			return nil, err
		}
		patterns = append(patterns, p)
	}
	if patterns == nil {
		patterns = []Pattern{}
	}
	return patterns, rows.Err()
}

func (s *Store) AddJobPattern(ctx context.Context, jobID, patternID uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO job_patterns (job_id, pattern_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		jobID, patternID,
	)
	return err
}

func (s *Store) RemoveJobPattern(ctx context.Context, jobID, patternID uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM job_patterns WHERE job_id = $1 AND pattern_id = $2`,
		jobID, patternID,
	)
	return err
}

// Stats holds current aggregate counts from the database.
type Stats struct {
	Jobs         int64
	ValidScans   int64
	InvalidScans int64
}

// GetStats returns live row counts for jobs and scans in a single round-trip.
func (s *Store) GetStats(ctx context.Context) (Stats, error) {
	var st Stats
	err := s.pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM jobs),
			COUNT(*) FILTER (WHERE valid = true),
			COUNT(*) FILTER (WHERE valid = false)
		 FROM scans`,
	).Scan(&st.Jobs, &st.ValidScans, &st.InvalidScans)
	return st, err
}

// GetJobRegexes returns the compiled regex strings for a job's active patterns.
// Returns nil if the job has no patterns (caller should fall back to global config).
func (s *Store) GetJobRegexes(ctx context.Context, jobID uuid.UUID) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT p.regex
		 FROM patterns p
		 JOIN job_patterns jp ON jp.pattern_id = p.id
		 WHERE jp.job_id = $1`,
		jobID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var regexes []string
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			return nil, err
		}
		regexes = append(regexes, r)
	}
	return regexes, rows.Err()
}

// GetJobTitleAndRegexes returns the job title and its pattern regexes in a single
// round-trip. Returns an error if the job does not exist.
func (s *Store) GetJobTitleAndRegexes(ctx context.Context, jobID uuid.UUID) (title string, regexes []string, err error) {
	rows, err := s.pool.Query(ctx,
		`SELECT j.title, p.regex
		 FROM jobs j
		 LEFT JOIN job_patterns jp ON jp.job_id = j.id
		 LEFT JOIN patterns p ON p.id = jp.pattern_id
		 WHERE j.id = $1`,
		jobID,
	)
	if err != nil {
		return "", nil, err
	}
	defer rows.Close()

	found := false
	for rows.Next() {
		var regex *string
		if err := rows.Scan(&title, &regex); err != nil {
			return "", nil, err
		}
		found = true
		if regex != nil {
			regexes = append(regexes, *regex)
		}
	}
	if err := rows.Err(); err != nil {
		return "", nil, err
	}
	if !found {
		return "", nil, fmt.Errorf("job not found")
	}
	return title, regexes, nil
}
