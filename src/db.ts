// Layer query D1. Mengembalikan tipe tegas, tidak ada raw SQL bocor ke route.

import type {
  Category,
  GeneratedRecipeContent,
  IngredientRow,
  RecipeFull,
  RecipeRow,
  RecipeStatus,
  StepRow,
} from "./types";

export async function listRecipes(db: D1Database): Promise<RecipeRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM recipes ORDER BY
       CASE status WHEN 'draft' THEN 0 WHEN 'generated' THEN 1 ELSE 2 END,
       title ASC`,
    )
    .all<RecipeRow>();
  return results ?? [];
}

export async function listPublishedRecipes(db: D1Database): Promise<RecipeRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM recipes WHERE status='published' ORDER BY title ASC`)
    .all<RecipeRow>();
  return results ?? [];
}

export async function listPublishedRecipesPaged(
  db: D1Database,
  opts: { category?: string; limit: number; offset: number },
): Promise<RecipeRow[]> {
  const limit = Math.max(1, Math.min(opts.limit, 100));
  const offset = Math.max(0, opts.offset);
  const sql = opts.category
    ? `SELECT * FROM recipes WHERE status='published' AND category = ? ORDER BY title ASC LIMIT ? OFFSET ?`
    : `SELECT * FROM recipes WHERE status='published' ORDER BY title ASC LIMIT ? OFFSET ?`;
  const stmt = opts.category
    ? db.prepare(sql).bind(opts.category, limit, offset)
    : db.prepare(sql).bind(limit, offset);
  const { results } = await stmt.all<RecipeRow>();
  return results ?? [];
}

export async function countPublishedRecipes(
  db: D1Database,
  category?: string,
): Promise<number> {
  const sql = category
    ? `SELECT COUNT(*) AS n FROM recipes WHERE status='published' AND category = ?`
    : `SELECT COUNT(*) AS n FROM recipes WHERE status='published'`;
  const stmt = category ? db.prepare(sql).bind(category) : db.prepare(sql);
  const row = await stmt.first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getRecipeFull(
  db: D1Database,
  id: string,
  publicBase: string,
): Promise<RecipeFull | null> {
  const recipe = await db
    .prepare(`SELECT * FROM recipes WHERE id = ?`)
    .bind(id)
    .first<RecipeRow>();
  if (!recipe) return null;

  const ing = await db
    .prepare(`SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position ASC`)
    .bind(id)
    .all<IngredientRow>();
  const steps = await db
    .prepare(`SELECT * FROM cooking_steps WHERE recipe_id = ? ORDER BY step_order ASC`)
    .bind(id)
    .all<StepRow>();

  return {
    recipe,
    ingredients: ing.results ?? [],
    steps: steps.results ?? [],
    imageUrl: imageUrlFor(recipe.image_key, publicBase),
  };
}

export function imageUrlFor(imageKey: string | null, _publicBase?: string): string | null {
  if (!imageKey) return null;
  // KV tidak punya public URL langsung, jadi kita arahkan ke worker endpoint kita sendiri.
  return `/api/images/${imageKey}`;
}

export async function saveGeneratedContent(
  db: D1Database,
  id: string,
  content: GeneratedRecipeContent,
): Promise<void> {
  const now = Date.now();
  const tagsCsv = content.tags.join(",");

  // D1 tidak mendukung BEGIN..COMMIT lewat exec; pakai batch untuk atomicity.
  const stmts: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM ingredients WHERE recipe_id = ?`).bind(id),
    db.prepare(`DELETE FROM cooking_steps WHERE recipe_id = ?`).bind(id),
    db
      .prepare(
        `UPDATE recipes SET
           description = ?, difficulty = ?, cooking_time_minutes = ?, servings = ?,
           tags_csv = ?, generated_at = ?, updated_at = ?,
           status = CASE WHEN status='published' THEN 'published' ELSE 'generated' END
         WHERE id = ?`,
      )
      .bind(
        content.description,
        content.difficulty,
        content.cookingTimeMinutes,
        content.servings,
        tagsCsv,
        now,
        now,
        id,
      ),
  ];

  content.ingredients.forEach((ing, idx) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO ingredients (recipe_id, position, name, quantity, unit) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(id, idx + 1, ing.name, ing.quantity, ing.unit),
    );
  });
  content.steps.forEach((step) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO cooking_steps (recipe_id, step_order, instruction) VALUES (?, ?, ?)`,
        )
        .bind(id, step.order, step.instruction),
    );
  });

  await db.batch(stmts);
}

export async function setImageKey(
  db: D1Database,
  id: string,
  imageKey: string,
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE recipes SET image_key = ?, image_generated_at = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(imageKey, now, now, id)
    .run();
}

export async function setStatus(
  db: D1Database,
  id: string,
  status: RecipeStatus,
): Promise<void> {
  const now = Date.now();
  const publishedAt = status === "published" ? now : null;
  await db
    .prepare(
      `UPDATE recipes SET status = ?, published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ?`,
    )
    .bind(status, publishedAt, now, id)
    .run();
}

export async function updateMeta(
  db: D1Database,
  id: string,
  patch: {
    title?: string;
    category?: Category;
    description?: string;
    difficulty?: string;
    cookingTimeMinutes?: number;
    servings?: number;
    tagsCsv?: string;
  },
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (patch.title !== undefined) { fields.push("title = ?"); values.push(patch.title); }
  if (patch.category !== undefined) { fields.push("category = ?"); values.push(patch.category); }
  if (patch.description !== undefined) { fields.push("description = ?"); values.push(patch.description); }
  if (patch.difficulty !== undefined) { fields.push("difficulty = ?"); values.push(patch.difficulty); }
  if (patch.cookingTimeMinutes !== undefined) { fields.push("cooking_time_minutes = ?"); values.push(patch.cookingTimeMinutes); }
  if (patch.servings !== undefined) { fields.push("servings = ?"); values.push(patch.servings); }
  if (patch.tagsCsv !== undefined) { fields.push("tags_csv = ?"); values.push(patch.tagsCsv); }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);
  await db.prepare(`UPDATE recipes SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function syncRecipes(
  db: D1Database,
  data: { name: string; category: Category }[]
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  // Kita gunakan batch untuk efisiensi. 
  // Strategi: INSERT OR IGNORE berdasarkan ID (ID di-generate dari nama yang di-slugify).
  const stmts: D1PreparedStatement[] = [];

  for (const item of data) {
    const slug = item.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) continue;

    stmts.push(
      db
        .prepare(`INSERT OR IGNORE INTO recipes (id, title, category, status, updated_at) VALUES (?, ?, ?, 'draft', ?)`)
        .bind(slug, item.name, item.category, Date.now())
    );
  }

  const results = await db.batch(stmts);
  results.forEach(r => {
    if (r.meta.changes > 0) added++;
    else skipped++;
  });

  return { added, skipped };
}
