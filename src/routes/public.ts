import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  countPublishedRecipes,
  getRecipeFull,
  imageUrlFor,
  listPublishedRecipes,
  listPublishedRecipesPaged,
} from "../db";
import type { Bindings } from "../types";
import { landingPage, recipeDetailPage } from "../views/landing";

export const publicRoutes = new Hono<{ Bindings: Bindings }>();

publicRoutes.use("/api/*", cors({ origin: "*", allowMethods: ["GET"] }));

// ── Landing Page Publik ──
publicRoutes.get("/", async (c) => {
  const rows = await listPublishedRecipes(c.env.DB);
  return c.html(landingPage(rows));
});

publicRoutes.get("/resep", async (c) => {
  const rows = await listPublishedRecipes(c.env.DB);
  return c.html(landingPage(rows));
});

publicRoutes.get("/resep/:id", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, "");
  if (!full || full.recipe.status !== "published") {
    return c.redirect("/resep");
  }
  return c.html(recipeDetailPage(full));
});

// Manifest ringan: list resep published dengan pagination opsional.
// Tanpa query params → return semua (backward compat).
// Dengan ?limit= dan/atau ?offset= → server-side pagination (disarankan untuk mobile).
// Filter ?category= untuk filter kategori di server.
publicRoutes.get("/api/recipes", async (c) => {
  const qLimit = c.req.query("limit");
  const qOffset = c.req.query("offset");
  const qCategory = c.req.query("category") || undefined;
  const paged = qLimit !== undefined || qOffset !== undefined;

  const rows = paged
    ? await listPublishedRecipesPaged(c.env.DB, {
        category: qCategory,
        limit: qLimit ? Math.max(1, Math.min(parseInt(qLimit, 10) || 10, 100)) : 10,
        offset: qOffset ? Math.max(0, parseInt(qOffset, 10) || 0) : 0,
      })
    : await listPublishedRecipes(c.env.DB);

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    difficulty: r.difficulty,
    cookingTimeMinutes: r.cooking_time_minutes,
    servings: r.servings,
    tags: r.tags_csv ? r.tags_csv.split(",") : [],
    imageUrl: imageUrlFor(r.image_key),
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
  }));

  const total = paged ? await countPublishedRecipes(c.env.DB, qCategory) : data.length;
  const effLimit = paged
    ? (qLimit ? Math.max(1, Math.min(parseInt(qLimit, 10) || 10, 100)) : 10)
    : data.length;
  const effOffset = paged ? (qOffset ? Math.max(0, parseInt(qOffset, 10) || 0) : 0) : 0;

  return c.json({
    version: latestVersion(rows),
    total,
    limit: effLimit,
    offset: effOffset,
    count: data.length,
    recipes: data,
  });
});

publicRoutes.get("/api/recipes/:id", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, "");
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

// Proxy untuk menyajikan gambar dari KV (pengganti R2 public URL)
publicRoutes.get("/api/images/recipes/:filename", async (c) => {
  const filename = c.req.param("filename");
  const key = `recipes/${filename}`;
  const { value, metadata } = await c.env.IMAGES.getWithMetadata<{ contentType: string }>(key, "arrayBuffer");

  if (!value) return c.notFound();

  return new Response(value, {
    headers: {
      "Content-Type": metadata?.contentType || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

function latestVersion(rows: { updated_at: number }[]): number {
  return rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), 0);
}
