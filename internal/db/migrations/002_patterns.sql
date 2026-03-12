-- +goose Up
CREATE TABLE patterns (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    regex      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO patterns (name, regex) VALUES ('Timeline', '^TL\d{8}$');

CREATE TABLE job_patterns (
    job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, pattern_id)
);

-- +goose Down
DROP TABLE job_patterns;
DROP TABLE patterns;
