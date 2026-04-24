-- Migration 004: in-app report mechanism (Google Play UGC/Generative AI compliance).
-- Apply:
--   wrangler d1 execute resep-db --remote --file=./migrations/004_reports.sql
--   wrangler d1 execute resep-db --local  --file=./migrations/004_reports.sql

CREATE TABLE IF NOT EXISTS recipe_reports (
    id          TEXT PRIMARY KEY,
    recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,                 -- 'inaccurate' | 'offensive' | 'dangerous' | 'other'
    detail      TEXT NOT NULL DEFAULT '',      -- optional free text dari user
    client_ip   TEXT,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_recipe  ON recipe_reports(recipe_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON recipe_reports(created_at DESC);

-- Tambah counter ke recipes untuk threshold auto-unpublish (hindari COUNT(*) query tiap request).
ALTER TABLE recipes ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;
