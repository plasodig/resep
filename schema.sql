-- Cloudflare D1 schema untuk resep_dashboard.
-- Status alur: draft -> generated -> published.
-- Mobile app hanya melihat baris dengan status='published'.

CREATE TABLE IF NOT EXISTS recipes (
    id                    TEXT PRIMARY KEY,           -- slug (mis. "nasi-goreng")
    title                 TEXT NOT NULL,
    category              TEXT NOT NULL,              -- enum string (MainCourse, Soup, dst)
    description           TEXT NOT NULL DEFAULT '',
    difficulty            TEXT NOT NULL DEFAULT 'Medium',
    cooking_time_minutes  INTEGER NOT NULL DEFAULT 30,
    servings              INTEGER NOT NULL DEFAULT 4,
    tags_csv              TEXT NOT NULL DEFAULT '',   -- "minang,pedas,gurih"
    image_key             TEXT,                       -- R2 object key, mis. "recipes/nasi-goreng.png"
    status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generated','published')),
    generated_at          INTEGER,                    -- epoch ms terakhir generate teks
    image_generated_at    INTEGER,                    -- epoch ms terakhir generate image
    published_at          INTEGER,                    -- epoch ms publish
    updated_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);

CREATE TABLE IF NOT EXISTS ingredients (
    recipe_id   TEXT NOT NULL,
    position    INTEGER NOT NULL,
    name        TEXT NOT NULL,
    quantity    TEXT NOT NULL DEFAULT '',
    unit        TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (recipe_id, position),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooking_steps (
    recipe_id   TEXT NOT NULL,
    step_order  INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    PRIMARY KEY (recipe_id, step_order),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
