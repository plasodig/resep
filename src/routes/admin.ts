import { Hono } from "hono";
import {
  getRecipeFull,
  listRecipes,
  saveGeneratedContent,
  setImageKey,
  setStatus,
  syncRecipes,
  updateMeta,
} from "../db";
import { generateImage, generateRecipe } from "../ai/client";
import { PoolIterator, getAccountPool, QuotaExhaustedError } from "../ai/pool";
import { uploadRecipeImage } from "../storage/kv";
import type { Bindings, Category } from "../types";
import { dashboardView } from "../views/dashboard";
import { detailView } from "../views/detail";

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

import { autoProcessDrafts } from "../service/autobot";

adminRoutes.get("/", async (c) => {
  const rows = await listRecipes(c.env.DB);
  const flash = readFlash(c.req.query("ok"), c.req.query("err"));
  return c.html(dashboardView(rows, flash));
});

adminRoutes.post("/sync", async (c) => {
  try {
    const res = await fetch(c.env.RECIPES_SYNC_URL);
    if (!res.ok) throw new Error(`GAS returned ${res.status}`);
    const data = await res.json() as any[];
    const result = await syncRecipes(c.env.DB, data);
    return c.redirect(`/admin?ok=${encodeURIComponent(`Sync berhasil: ${result.added} resep baru ditambahkan.`)}`);
  } catch (e) {
    return c.redirect(`/admin?err=${encodeURIComponent(errMsg("Sync gagal", e))}`);
  }
});

adminRoutes.post("/autobot/run", async (c) => {
  // Jalankan di background supaya browser bisa langsung di-close
  c.executionCtx.waitUntil(autoProcessDrafts(c.env));
  return c.redirect("/admin?ok=" + encodeURIComponent("Autobot dijalankan di background server. Proses akan berjalan otomatis."));
});

adminRoutes.get("/recipes/:id", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, "");
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
  return c.redirect(`/admin/recipes/${id}?ok=${encodeURIComponent("Metadata disimpan.")}`);
});

adminRoutes.post("/recipes/:id/generate-text", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, "");
  if (!full) return c.notFound();
  try {
    const slots = await getAccountPool(c.env.IMAGES, c.env.AI_POOL_URL, c.env.ACCOUNT_POOL_JSON);
    const pool = new PoolIterator(slots);
    const content = await generateRecipe(pool, full.recipe.title, full.recipe.category);
    await saveGeneratedContent(c.env.DB, id, content);
    return c.redirect(`/admin/recipes/${id}?ok=${encodeURIComponent("Teks resep berhasil di-generate.")}`);
  } catch (e) {
    return c.redirect(`/admin/recipes/${id}?err=${encodeURIComponent(errMsg("Generate teks gagal", e))}`);
  }
});

adminRoutes.post("/recipes/:id/generate-image", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, "");
  if (!full) return c.notFound();
  try {
    const slots = await getAccountPool(c.env.IMAGES, c.env.AI_POOL_URL, c.env.ACCOUNT_POOL_JSON);
    const pool = new PoolIterator(slots);
    const image = await generateImage(pool, full.recipe.title, full.recipe.category);
    const key = await uploadRecipeImage(c.env.IMAGES, id, image);
    await setImageKey(c.env.DB, id, key);
    return c.redirect(`/admin/recipes/${id}?ok=${encodeURIComponent("Gambar berhasil di-generate.")}`);
  } catch (e) {
    return c.redirect(`/admin/recipes/${id}?err=${encodeURIComponent(errMsg("Generate gambar gagal", e))}`);
  }
});

adminRoutes.post("/recipes/:id/generate-all", async (c) => {
  const id = c.req.param("id");
  const full = await getRecipeFull(c.env.DB, id, "");
  if (!full) return c.notFound();
  const errors: string[] = [];
  // Pakai 2 PoolIterator terpisah supaya kegagalan teks tidak mempengaruhi rotasi gambar.
  const pool = await getAccountPool(c.env.IMAGES, c.env.AI_POOL_URL, c.env.ACCOUNT_POOL_JSON);

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
    return c.redirect(`/admin/recipes/${id}?err=${encodeURIComponent(errors.join(" | "))}`);
  }

  // Otomatis publish jika sukses
  await setStatus(c.env.DB, id, "published");
  return c.redirect(`/admin/recipes/${id}?ok=${encodeURIComponent("Teks + gambar selesai di-generate dan otomatis di-publish.")}`);
});

adminRoutes.post("/recipes/:id/publish", async (c) => {
  const id = c.req.param("id");
  await setStatus(c.env.DB, id, "published");
  return c.redirect(`/admin/recipes/${id}?ok=${encodeURIComponent("Resep di-publish.")}`);
});

adminRoutes.post("/recipes/:id/unpublish", async (c) => {
  const id = c.req.param("id");
  await setStatus(c.env.DB, id, "generated");
  return c.redirect(`/admin/recipes/${id}?ok=${encodeURIComponent("Resep di-unpublish.")}`);
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
