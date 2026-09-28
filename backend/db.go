package main

import (
	"database/sql"
	"os"

	_ "github.com/lib/pq"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS locations (
    id           BIGSERIAL PRIMARY KEY,
    category     TEXT NOT NULL,
    lat          DOUBLE PRECISION NOT NULL,
    lng          DOUBLE PRECISION NOT NULL,
    properties   JSONB NOT NULL DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
    source       TEXT NOT NULL DEFAULT 'submission'
                 CHECK (source IN ('seed', 'submission')),
    submitted_by TEXT,
    reviewed_by  TEXT,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrades a locations table that predates the source column (CREATE TABLE
-- IF NOT EXISTS above is a no-op on an existing table, so it can't add this).
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'submission'
    CHECK (source IN ('seed', 'submission'));

CREATE INDEX IF NOT EXISTS idx_locations_status_category ON locations (status, category);
`

func openDB() (*sql.DB, error) {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgres://postgres:postgres@localhost:5432/umn_map?sslmode=disable"
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}
	if _, err = db.Exec(schemaSQL); err != nil {
		return nil, err
	}

	return db, nil
}
