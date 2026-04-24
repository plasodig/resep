import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import {
  countPublishedRecipes,
  createProcessingRequest,
  createReport,
  findProcessingRequestBySlug,
  findRecipeById,
  getRecipeFull,
  getRequest,
  imageUrlFor,
  listPublishedRecipes,
  listPublishedRecipesPaged,
  slugifyQuery,
} from "../db";
import { rateLimit, clientIp } from "../middleware/rateLimit";
import { validateFoodQuery } from "../service/contentSafety";
import { processGenerationRequest } from "../service/generator";
import { findSuggestions } from "../service/suggestions";
import type { Bindings } from "../types";
import { landingPage, recipeDetailPage } from "../views/landing";
import { contactPage, privacyPolicyPage, termsOfUsePage } from "../views/legal";

export const publicRoutes = new Hono<{ Bindings: Bindings }>();

publicRoutes.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));

// ── Legal Pages ──
publicRoutes.get("/privacy-policy", (c) => c.html(privacyPolicyPage()));
publicRoutes.get("/terms", (c) => c.html(termsOfUsePage()));
publicRoutes.get("/contacts", (c) => c.html(contactPage()));

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

// ---- Demand-driven flow (Option A + B hybrid) -----------------------------

// A. Suggestions: saran resep yang sudah published untuk query user yang miss.
//    Zero-LLM — gratis dan instant (<50ms SQL).
publicRoutes.post(
  "/api/suggestions",
  rateLimit({ bucket: "suggestions", limit: 20, windowSec: 3600 }),
  async (c) => {
    let body: { query?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "invalid_body" }, 400);
    }
    const query = (body.query ?? "").trim();
    if (query.length < 2 || query.length > 100) {
      return c.json({ success: false, error: "invalid_query" }, 400);
    }
    const suggestions = await findSuggestions(c.env.DB, query, 5);
    return c.json({
      success: true,
      query,
      count: suggestions.length,
      suggestions: suggestions.map(({ score: _score, ...rest }) => rest),
    });
  },
);

// B. Auto-generate: user minta resep baru → langsung dispatch AI generation di background.
// Response return cepat (<500ms) dengan requestId. Mobile polling /api/requests/:id tiap
// 3-5 detik sampai status completed/failed. Total wall-clock ~15-45 detik.
publicRoutes.post(
  "/api/requests",
  rateLimit({ bucket: "requests", limit: 5, windowSec: 3600 }),
  (c) => handleGenerationSubmit(c),
);

// B.2 Escape-hatch setelah user tonton rewarded ad: bypass rate limit biasa.
// Cap longgar (10/jam/IP) tetap diterapkan sebagai defense-in-depth kalau ada abuse.
publicRoutes.post(
  "/api/requests/extra",
  rateLimit({ bucket: "requests_extra", limit: 10, windowSec: 3600 }),
  (c) => handleGenerationSubmit(c),
);

/**
 * Handler bersama yang dipakai dua endpoint. Dipisahkan agar rate limit bisa beda
 * per jalur (reguler vs rewarded unlock) tanpa duplikasi logic.
 */
async function handleGenerationSubmit(c: Context<{ Bindings: Bindings }>) {
  let body: { query?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "invalid_body" }, 400);
  }
  const query = (body.query ?? "").trim();
  if (query.length < 3 || query.length > 100) {
    return c.json({ success: false, error: "invalid_query" }, 400);
  }
  const safety = validateFoodQuery(query);
  if (!safety.ok) {
    return c.json(
      { success: false, error: "unsafe_query", message: safety.reason },
      400,
    );
  }
  const slug = slugifyQuery(query);
  if (slug.length < 3) {
    return c.json({ success: false, error: "invalid_query" }, 400);
  }

  const existingRecipe = await findRecipeById(c.env.DB, slug);
  if (existingRecipe && existingRecipe.status === "published") {
    return c.json({
      success: true,
      status: "already_exists",
      recipeId: existingRecipe.id,
      message: "Resep sudah tersedia di katalog.",
    });
  }
  const existingReq = await findProcessingRequestBySlug(c.env.DB, slug);
  if (existingReq) {
    return c.json({
      success: true,
      status: "processing",
      requestId: existingReq.id,
      requestStatus: existingReq.status,
      message: "Resep sedang dibuat. Tunggu sebentar ya.",
    });
  }

  const id = randomId();
  await createProcessingRequest(c.env.DB, {
    id,
    query,
    slugTarget: slug,
    clientIp: clientIp(c),
  });
  c.executionCtx.waitUntil(processGenerationRequest(c.env, id, query, slug));

  return c.json(
    {
      success: true,
      status: "processing",
      requestId: id,
      requestStatus: "processing",
      message: "Resep sedang dibuat. Biasanya butuh 15-30 detik.",
    },
    202,
  );
}

// B. Poll status request.
publicRoutes.get("/api/requests/:id", async (c) => {
  const id = c.req.param("id");
  const req = await getRequest(c.env.DB, id);
  if (!req) return c.json({ success: false, error: "not_found" }, 404);
  return c.json({
    success: true,
    id: req.id,
    status: req.status,
    query: req.query,
    slugTarget: req.slug_target,
    requestedAt: req.requested_at,
    completedAt: req.completed_at,
    errorMessage: req.error_message,
    recipeId: req.resulting_recipe_id,
  });
});

// ---- In-app report (Google Play UGC + AI compliance) ---------------------

const VALID_REASONS = new Set([
  "inaccurate", // resep tidak akurat / bahan salah
  "offensive",  // konten menyinggung
  "dangerous",  // berbahaya untuk dikonsumsi
  "other",
]);

publicRoutes.post(
  "/api/recipes/:id/report",
  rateLimit({ bucket: "reports", limit: 10, windowSec: 3600 }),
  async (c) => {
    const recipeId = c.req.param("id");
    let body: { reason?: string; detail?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "invalid_body" }, 400);
    }
    const reason = (body.reason ?? "").trim().toLowerCase();
    const detail = (body.detail ?? "").trim().slice(0, 500);
    if (!VALID_REASONS.has(reason)) {
      return c.json({ success: false, error: "invalid_reason" }, 400);
    }
    const recipe = await findRecipeById(c.env.DB, recipeId);
    if (!recipe) {
      return c.json({ success: false, error: "not_found" }, 404);
    }

    const result = await createReport(c.env.DB, {
      id: crypto.randomUUID(),
      recipeId,
      reason: reason as "inaccurate" | "offensive" | "dangerous" | "other",
      detail,
      clientIp: clientIp(c),
    });

    return c.json({
      success: true,
      reportCount: result.reportCount,
      unpublished: result.unpublished,
      message: result.unpublished
        ? "Laporan diterima. Resep telah otomatis disembunyikan untuk ditinjau."
        : "Laporan diterima. Terima kasih atas masukanmu.",
    });
  },
);

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

function randomId(): string {
  // crypto.randomUUID tersedia di Workers runtime.
  return crypto.randomUUID();
}
