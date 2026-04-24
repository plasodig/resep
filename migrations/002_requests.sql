-- Migration 002: demand-driven generation_requests.
-- Apply ke remote D1:
--   wrangler d1 execute resep-db --remote --file=./migrations/002_requests.sql
-- Apply ke local D1:
--   wrangler d1 execute resep-db --local  --file=./migrations/002_requests.sql

CREATE TABLE IF NOT EXISTS generation_requests (
    id                   TEXT PRIMARY KEY,              -- uuid/random
    query                TEXT NOT NULL,                 -- original user query
    slug_target          TEXT NOT NULL,                 -- slugified id untuk tabel recipes
    status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected','completed')),
    client_ip            TEXT,                          -- cf-connecting-ip (rate limit audit)
    requested_at         INTEGER NOT NULL,              -- epoch ms
    reviewed_at          INTEGER,                       -- epoch ms saat approve/reject
    rejection_reason     TEXT,
    resulting_recipe_id  TEXT REFERENCES recipes(id)    -- set saat completed
);

CREATE INDEX IF NOT EXISTS idx_requests_status
    ON generation_requests(status, requested_at);

CREATE INDEX IF NOT EXISTS idx_requests_slug
    ON generation_requests(slug_target);
