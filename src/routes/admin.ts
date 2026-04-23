import { Hono } from "hono";
import {
  getRecipeFull,
  listRecipes,
  saveGeneratedContent,
  setImageKey,
  setStatus,
  updateMeta,
} from "../db";
import { generateImage, generateRecipe } from "../ai/client";
import { PoolIterator, parseAccountPool, QuotaExhaustedError } from "../ai/pool";
import { uploadRecipeImage } from "../storage/r2";
import type { Bindings, Category } from "../types";
import { dashboardView } from "../views/dashboard";
import { detailView } from "../views/detail";

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

adminRoutes.get("/", async (c) => {
  const rows = await listRecipes(c.env.DB);
  const flash = readFlash(c.req.query("ok"), c.req.query("err"));
  return c.html(dashboardView(rows, flash));
});

adminRoutes.get("/recipes/:id", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, c.env.R2_PUBLIC_BASE);
  if (!full) return c.notFound();
  const flash = readFlash(c.req.query("ok"), c.req.query("err"));
  return c.html(detailView(full, flash));
});

adminRoutes.post("/recipes/:id/update", async (c) => {
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  await updateMeta(c.env.DB, id, {
    title: str(form.title),
    category: str(form.category) as Category,
    description: str(form.description),
    difficulty: str(form.difficulty),
    cookingTimeMinutes: int(form.cooking_time_minutes, 30),
    servings: int(form.servings, 4),
    tagsCsv: normalizeTags(str(form.tags_csv)),
  });
  return c.redirect(`/recipes/${id}?ok=${encodeURIComponent("Metadata disimpan.")}`);
});

adminRoutes.post("/recipes/:id/generate-text", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, c.env.R2_PUBLIC_BASE);
  if (!full) return c.notFound();
  try {
    const pool = new PoolIterator(parseAccountPool(c.env.ACCOUNT_POOL_JSON));
    const content = await generateRecipe(pool, full.recipe.title, full.recipe.category);
    await saveGeneratedContent(c.env.DB, id, content);
    return c.redirect(`/recipes/${id}?ok=${encodeURIComponent("Teks resep berhasil di-generate.")}`);
  } catch (e) {
    return c.redirect(`/recipes/${id}?err=${encodeURIComponent(errMsg("Generate teks gagal", e))}`);
  }
});

adminRoutes.post("/recipes/:id/generate-image", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, c.env.R2_PUBLIC_BASE);
  if (!full) return c.notFound();
  try {
    const pool = new PoolIterator(parseAccountPool(c.env.ACCOUNT_POOL_JSON));
    const image = await generateImage(pool, full.recipe.title, full.recipe.category);
    const key = await uploadRecipeImage(c.env.IMAGES, id, image);
    await setImageKey(c.env.DB, id, key);
    return c.redirect(`/recipes/${id}?ok=${encodeURIComponent("Gambar berhasil di-generate.")}`);
  } catch (e) {
    return c.redirect(`/recipes/${id}?err=${encodeURIComponent(errMsg("Generate gambar gagal", e))}`);
  }
});

adminRoutes.post("/recipes/:id/generate-all", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, c.env.R2_PUBLIC_BASE);
  if (!full) return c.notFound();
  const errors: string[] = [];
  // Pakai 2 PoolIterator terpisah supaya kegagalan teks tidak mempengaruhi rotasi gambar.
  const pool = parseAccountPool(c.env.ACCOUNT_POOL_JSON);

  // Jalankan paralel — sama persis dengan strategi runtime AI lama di Kotlin.
  const [textResult, imageResult] = await Promise.allSettled([
    (async () => {
      const content = await generateRecipe(new PoolIterator(pool), full.recipe.title, full.recipe.category);
      await saveGeneratedContent(c.env.DB, id, content);
    })(),
    (async () => {
      const image = await generateImage(new PoolIterator(pool), full.recipe.title, full.recipe.category);
      const key = await uploadRecipeImage(c.env.IMAGES, id, image);
      await setImageKey(c.env.DB, id, key);
    })(),
  ]);

  if (textResult.status === "rejected") errors.push(errMsg("teks", textResult.reason));
  if (imageResult.status === "rejected") errors.push(errMsg("gambar", imageResult.reason));

  if (errors.length > 0) {
    return c.redirect(`/recipes/${id}?err=${encodeURIComponent(errors.join(" | "))}`);
  }
  return c.redirect(`/recipes/${id}?ok=${encodeURIComponent("Teks + gambar selesai di-generate.")}`);
});

adminRoutes.post("/recipes/:id/publish", async (c) => {
  const id = c.req.param("id");
  await setStatus(c.env.DB, id, "published");
  return c.redirect(`/recipes/${id}?ok=${encodeURIComponent("Resep di-publish.")}`);
});

adminRoutes.post("/recipes/:id/unpublish", async (c) => {
  const id = c.req.param("id");
  await setStatus(c.env.DB, id, "generated");
  return c.redirect(`/recipes/${id}?ok=${encodeURIComponent("Resep di-unpublish.")}`);
});

// ---- helpers ---------------------------------------------------------------

function readFlash(ok?: string, err?: string): { kind: "ok" | "error"; msg: string } | undefined {
  if (err) return { kind: "error", msg: err };
  if (ok) return { kind: "ok", msg: ok };
  return undefined;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function int(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function normalizeTags(s: string): string {
  return s
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .join(",");
}

function errMsg(prefix: string, e: unknown): string {
  if (e instanceof QuotaExhaustedError) {
    return `${prefix}: semua slot Cloudflare AI gagal di attempt ini`;
  }
  if (e instanceof Error) return `${prefix}: ${e.message}`;
  return `${prefix}: error tidak dikenal`;
}
