-- +goose Up
CREATE TABLE jobs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scans (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    barcode    TEXT NOT NULL,
    valid      BOOLEAN NOT NULL DEFAULT true,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scans_job_id_idx ON scans (job_id);

-- +goose Down
DROP TABLE scans;
DROP TABLE jobs;
