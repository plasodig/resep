// Demand-driven generator: dijalankan sebagai background task (ctx.waitUntil) dari
// POST /api/requests. End-to-end ~15-45 detik tergantung latency AI pool.
//
// Flow:
//   1. Pastikan row `recipes` dengan id = slug ada (insert kalau belum ada).
//   2. Generate text (Llama) + image (FLUX) paralel via PoolIterator.
//   3. Simpan konten, upload image ke KV, set status='published'.
//   4. Mark request completed (linked ke recipeId).
//
// Kalau di tengah ada error → mark request failed + error_message, recipe row tetap draft.

import { generateImage, generateRecipe } from "../ai/client";
import { getAccountPool, PoolIterator, QuotaExhaustedError } from "../ai/pool";
import {
    findRecipeById,
    markRequestCompleted,
    markRequestFailed,
    saveGeneratedContent,
    setImageKey,
    setStatus,
} from "../db";
import { uploadRecipeImage } from "../storage/kv";
import type { Bindings, Category } from "../types";
import { validateFoodQuery, validateGeneratedContent } from "./contentSafety";

/**
 * Ubah query jadi Title Case. "mie kudus" → "Mie Kudus"
 */
function prettifyQuery(query: string): string {
    return query
        .trim()
        .split(/\s+/)
        .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(" ");
}

export async function processGenerationRequest(
    env: Bindings,
    requestId: string,
    query: string,
    slug: string,
): Promise<void> {
    console.log(`[generator=${requestId}] START slug=${slug} query="${query}"`);

    // Pre-check 1: query safety — blocklist NSFW/senjata/obat/medis. Cepat & gratis.
    const queryCheck = validateFoodQuery(query);
    if (!queryCheck.ok) {
        console.warn(`[generator=${requestId}] REJECTED query safety: ${queryCheck.reason}`);
        await markRequestFailed(env.DB, requestId, queryCheck.reason ?? "Query tidak valid");
        return;
    }

    const title = prettifyQuery(query);
    const category: Category = "MainCourse"; // default — admin bisa edit di dashboard

    try {
        // 1. Pastikan row recipes ada (sebagai draft kalau baru).
        const existing = await findRecipeById(env.DB, slug);
        if (!existing) {
            await env.DB.prepare(
                `INSERT INTO recipes (id, title, category, status, updated_at) VALUES (?, ?, ?, 'draft', ?)`,
            )
                .bind(slug, title, category, Date.now())
                .run();
        }

        // 2. Siapkan AI pool.
        const pool = await getAccountPool(env.IMAGES, env.AI_POOL_URL, env.ACCOUNT_POOL_JSON);
        console.log(`[generator=${requestId}] pool siap dengan ${pool.length} akun.`);

        // 3. Generate paralel (text + image) — pakai PoolIterator terpisah.
        const effectiveCategory = existing?.category ?? category;
        const effectiveTitle = existing?.title ?? title;
        const [text, image] = await Promise.all([
            generateRecipe(new PoolIterator(pool), effectiveTitle, effectiveCategory),
            generateImage(new PoolIterator(pool), effectiveTitle, effectiveCategory),
        ]);

        // Pre-check 2: kalau AI tolak (system prompt "not_food"), description kemungkinan
        // kosong atau ingredients/steps kosong → validator akan catch.
        // Pre-check 3: post-generation safety — tolak kalau mengandung klaim medis.
        const contentCheck = validateGeneratedContent(text);
        if (!contentCheck.ok) {
            console.warn(
                `[generator=${requestId}] REJECTED content safety: ${contentCheck.reason}`,
            );
            await markRequestFailed(env.DB, requestId, contentCheck.reason ?? "Konten ditolak");
            return;
        }

        // 4. Persist konten + gambar.
        await saveGeneratedContent(env.DB, slug, text);
        const imageKey = await uploadRecipeImage(env.IMAGES, slug, image);
        await setImageKey(env.DB, slug, imageKey);
        await setStatus(env.DB, slug, "published");

        // 5. Mark request completed.
        await markRequestCompleted(env.DB, requestId, slug);
        console.log(`[generator=${requestId}] COMPLETED → recipe=${slug} published.`);
    } catch (e) {
        const msg = errorMessage(e);
        console.error(`[generator=${requestId}] FAILED: ${msg}`);
        await markRequestFailed(env.DB, requestId, msg).catch((inner) => {
            console.error(`[generator=${requestId}] markRequestFailed also failed:`, inner);
        });
    }
}

function errorMessage(e: unknown): string {
    if (e instanceof QuotaExhaustedError) return "Semua slot AI habis kuota";
    if (e instanceof Error) return e.message.slice(0, 500);
    return "Unknown error";
}
