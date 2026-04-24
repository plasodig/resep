import { generateImage, generateRecipe } from "../ai/client";
import { getAccountPool, PoolIterator } from "../ai/pool";
import {
    getRecipeFull,
    saveGeneratedContent,
    setImageKey,
    setStatus,
} from "../db";
import { uploadRecipeImage } from "../storage/kv";
import type { Bindings } from "../types";

/**
 * Cron tiap jam untuk proses draft dari bulk sync (GAS spreadsheet). Demand-driven
 * requests dari user TIDAK di-pick oleh cron — mereka di-dispatch langsung via
 * ctx.waitUntil di route POST /api/requests (lihat src/service/generator.ts).
 */
export async function autoProcessDrafts(env: Bindings): Promise<void> {
    const { results: drafts } = await env.DB.prepare(
        "SELECT id FROM recipes WHERE status = 'draft' LIMIT 1",
    ).all<{ id: string }>();

    if (!drafts || drafts.length === 0) {
        console.log("Autobot: Tidak ada draft untuk diproses.");
        return;
    }

    const pool = await getAccountPool(env.IMAGES, env.AI_POOL_URL, env.ACCOUNT_POOL_JSON);
    console.log(`Autobot: Pool AI siap dengan ${pool.length} akun.`);

    for (const draft of drafts) {
        try {
            console.log(`Autobot: Menghasilkan resep untuk ${draft.id}...`);
            const full = await getRecipeFull(env.DB, draft.id, "");
            if (!full) continue;

            const [text, image] = await Promise.all([
                generateRecipe(new PoolIterator(pool), full.recipe.title, full.recipe.category),
                generateImage(new PoolIterator(pool), full.recipe.title, full.recipe.category),
            ]);

            await saveGeneratedContent(env.DB, draft.id, text);
            const key = await uploadRecipeImage(env.IMAGES, draft.id, image);
            await setImageKey(env.DB, draft.id, key);
            await setStatus(env.DB, draft.id, "published");

            console.log(`Autobot: SUCCESS ${draft.id} published.`);
        } catch (e) {
            console.error(`Autobot: FAILED ${draft.id}:`, e);
        }
    }
}
