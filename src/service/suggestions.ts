// Ranking suggestions 100% berbasis SQL D1 — TIDAK PAKAI LLM supaya gratis dan instant.
// Strategi: satu SELECT LIKE lalu re-rank di memory berdasarkan kriteria heuristik yang
// masuk akal untuk pencarian resep.

import type { RecipeRow } from "../types";
import { imageUrlFor } from "../db";

export interface RecipeSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: string;
  cookingTimeMinutes: number;
  tags: string[];
  imageUrl: string | null;
  score: number; // untuk debugging — bisa di-strip sebelum kirim ke client
}

/**
 * Cari suggestions untuk query user di tabel `recipes` (status published).
 *
 * Ranking (semakin tinggi semakin relevan):
 *   100 — exact title match (case-insensitive)
 *    70 — title dimulai dengan query
 *    50 — query terkandung di title
 *    30 — query cocok dengan satu tag
 *    15 — query terkandung di description
 *
 * Lalu tiebreaker: cooking_time ASC (resep lebih cepat dulu).
 */
export async function findSuggestions(
  db: D1Database,
  rawQuery: string,
  limit: number = 5,
): Promise<RecipeSuggestion[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const like = `%${q}%`;

  // Ambil candidate yang punya substring match di salah satu kolom yang relevan.
  // Index idx_recipes_status mempercepat filter status='published'.
  const { results } = await db
    .prepare(
      `SELECT id, title, category, description, difficulty, cooking_time_minutes,
              servings, tags_csv, image_key, status, generated_at, image_generated_at,
              published_at, updated_at
       FROM recipes
       WHERE status = 'published'
         AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags_csv) LIKE ?)
       LIMIT 30`,
    )
    .bind(like, like, like)
    .all<RecipeRow>();

  const rows = results ?? [];

  const scored: RecipeSuggestion[] = rows.map((r) => {
    const title = r.title.toLowerCase();
    const tags = (r.tags_csv ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const desc = (r.description ?? "").toLowerCase();

    let score = 0;
    if (title === q) score = Math.max(score, 100);
    if (title.startsWith(q)) score = Math.max(score, 70);
    if (title.includes(q)) score = Math.max(score, 50);
    if (tags.some((t) => t === q || t.includes(q))) score = Math.max(score, 30);
    if (desc.includes(q)) score = Math.max(score, 15);

    return {
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description,
      difficulty: r.difficulty,
      cookingTimeMinutes: r.cooking_time_minutes,
      tags,
      imageUrl: imageUrlFor(r.image_key),
      score,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.cookingTimeMinutes - b.cookingTimeMinutes;
  });

  return scored.slice(0, limit);
}
