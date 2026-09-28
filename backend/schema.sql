-- Reference copy of the schema db.go applies automatically at startup.

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
