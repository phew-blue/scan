-- +goose Up
ALTER TABLE patterns ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
UPDATE patterns SET is_default = true WHERE name = 'Timeline';

-- +goose Down
ALTER TABLE patterns DROP COLUMN is_default;
