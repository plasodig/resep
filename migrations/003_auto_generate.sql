-- Migration 003: generation_requests jadi job tracker auto-generate (tanpa admin approval).
-- Status transitions: processing → completed | failed
--
-- Apply ke remote D1:
--   wrangler d1 execute resep-db --remote --file=./migrations/003_auto_generate.sql
-- Apply ke local D1:
--   wrangler d1 execute resep-db --local  --file=./migrations/003_auto_generate.sql

DROP TABLE IF EXISTS generation_requests;

CREATE TABLE generation_requests (
    id                   TEXT PRIMARY KEY,
    query                TEXT NOT NULL,
    slug_target          TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'processing'
                         CHECK (status IN ('processing','completed','failed')),
    client_ip            TEXT,
    requested_at         INTEGER NOT NULL,
    completed_at         INTEGER,
    error_message        TEXT,
    resulting_recipe_id  TEXT REFERENCES recipes(id)
);

CREATE INDEX idx_requests_status ON generation_requests(status, requested_at);
CREATE INDEX idx_requests_slug   ON generation_requests(slug_target);
