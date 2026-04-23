// Endpoint publik untuk mobile app. Hanya expose status='published'.
// CORS terbuka — mobile app native tidak terkena CORS, tapi web browser test bisa akses.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { getRecipeFull, imageUrlFor, listPublishedRecipes } from "../db";
import type { Bindings } from "../types";

export const publicRoutes = new Hono<{ Bindings: Bindings }>();

publicRoutes.use("/api/*", cors({ origin: "*", allowMethods: ["GET"] }));

// Manifest ringan: list semua resep published, tanpa ingredients/steps (hemat bandwidth).
// Mobile app pakai ini untuk render list, lalu fetch detail saat user buka.
publicRoutes.get("/api/recipes", async (c) => {
  const rows = await listPublishedRecipes(c.env.DB);
  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    difficulty: r.difficulty,
    cookingTimeMinutes: r.cooking_time_minutes,
    servings: r.servings,
    tags: r.tags_csv ? r.tags_csv.split(",") : [],
    imageUrl: imageUrlFor(r.image_key, c.env.R2_PUBLIC_BASE),
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
  }));
  return c.json({
    version: latestVersion(rows),
    count: data.length,
    recipes: data,
  });
});

publicRoutes.get("/api/recipes/:id", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, c.env.R2_PUBLIC_BASE);
  if (!full || full.recipe.status !== "published") {
    return c.json({ error: "not_found" }, 404);
  }
  const r = full.recipe;
  return c.json({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    difficulty: r.difficulty,
    cookingTimeMinutes: r.cooking_time_minutes,
    servings: r.servings,
    tags: r.tags_csv ? r.tags_csv.split(",") : [],
    imageUrl: full.imageUrl,
    ingredients: full.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
    steps: full.steps.map((s) => ({ order: s.step_order, instruction: s.instruction })),
    publishedAt: r.published_at,
  });
});

// Healthcheck sederhana
publicRoutes.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

function latestVersion(rows: { updated_at: number }[]): number {
  return rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), 0);
}
