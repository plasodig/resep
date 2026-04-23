// Port dari core/data/.../AiGenerationClient.kt — pakai native fetch (tersedia di Workers).
// Endpoint: https://api.cloudflare.com/client/v4/accounts/<accountId>/ai/run/<model>

import type { GeneratedImageBytes, GeneratedRecipeContent } from "../types";
import { type AccountSlot, PoolIterator, QuotaExhaustedError } from "./pool";
import { SYSTEM_RECIPE, imagePrompt, userPromptRecipe } from "./prompts";

const PRIMARY_TEXT_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const FALLBACK_TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_ATTEMPTS = 4;

interface CfEnvelope<T> {
  success: boolean;
  result?: T | null;
  errors?: { code?: number; message?: string }[];
}

function cloudflareUrl(slot: AccountSlot, model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${slot.accountId}/ai/run/${model}`;
}

async function callOnce(
  slot: AccountSlot,
  model: string,
  body: unknown,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    return await fetch(cloudflareUrl(slot, model), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${slot.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runWithRotation<T>(
  pool: PoolIterator,
  model: string,
  body: unknown,
  parse: (res: Response) => Promise<T>,
): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let slot: AccountSlot;
    try {
      slot = pool.next();
    } catch (e) {
      if (e instanceof QuotaExhaustedError) throw e;
      throw e;
    }
    try {
      const res = await callOnce(slot, model, body);
      if (res.status === 429) {
        pool.markFailed(slot.id);
        lastErr = new Error(`Slot ${slot.id} 429 quota`);
        continue;
      }
      if (res.status >= 500) {
        pool.markFailed(slot.id);
        lastErr = new Error(`Slot ${slot.id} HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Cloudflare ${res.status}: ${txt.slice(0, 300)}`);
      }
      try {
        return await parse(res);
      } catch (e) {
        pool.markFailed(slot.id);
        lastErr = e;
        continue;
      }
    } catch (e) {
      pool.markFailed(slot.id);
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`AI gagal setelah ${MAX_ATTEMPTS} attempt`);
}

// ---- Recipe text -----------------------------------------------------------

export async function generateRecipe(
  pool: PoolIterator,
  title: string,
  categoryHint: string,
): Promise<GeneratedRecipeContent> {
  const tryModel = async (model: string) => {
    const body = {
      messages: [
        { role: "system", content: SYSTEM_RECIPE },
        { role: "user", content: userPromptRecipe(title, categoryHint) },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    };
    return await runWithRotation(pool, model, body, async (res) => {
      const env = (await res.json()) as CfEnvelope<{ response?: string }>;
      const text = env.result?.response;
      if (!env.success || !text) {
        const errMsg = JSON.stringify(env.errors ?? []);
        throw new Error(`AI returned success=false: ${errMsg}`);
      }
      return parseRecipeJson(text);
    });
  };

  try {
    return await tryModel(PRIMARY_TEXT_MODEL);
  } catch (e) {
    if (e instanceof QuotaExhaustedError) throw e;
    console.warn(`Primary ${PRIMARY_TEXT_MODEL} failed: ${(e as Error).message}. Fallback ke ${FALLBACK_TEXT_MODEL}`);
    return await tryModel(FALLBACK_TEXT_MODEL);
  }
}

function parseRecipeJson(raw: string): GeneratedRecipeContent {
  let text = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
  if (fence?.[1]) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("no JSON object found in AI response");
  text = text.slice(first, last + 1);

  const parsed = JSON.parse(text) as {
    description?: string;
    difficulty?: string;
    cooking_time_minutes?: number;
    servings?: number;
    ingredients?: { name?: string; quantity?: string; unit?: string }[];
    steps?: string[];
    tags?: string[];
  };
  return {
    description: (parsed.description ?? "").trim(),
    difficulty: (parsed.difficulty ?? "Medium").trim() || "Medium",
    cookingTimeMinutes: clamp(parsed.cooking_time_minutes ?? 30, 1, 720),
    servings: clamp(parsed.servings ?? 4, 1, 50),
    ingredients: (parsed.ingredients ?? []).map((i) => ({
      name: (i.name ?? "").trim(),
      quantity: (i.quantity ?? "").trim(),
      unit: (i.unit ?? "").trim(),
    })),
    steps: (parsed.steps ?? []).map((s, idx) => ({
      order: idx + 1,
      instruction: (s ?? "").trim(),
    })),
    tags: (parsed.tags ?? []).map((t) => t.toLowerCase().trim()),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n | 0));
}

// ---- Image -----------------------------------------------------------------

export async function generateImage(
  pool: PoolIterator,
  title: string,
  category: string,
): Promise<GeneratedImageBytes> {
  const body = { prompt: imagePrompt(title, category), steps: 4 };
  return await runWithRotation(pool, IMAGE_MODEL, body, async (res) => {
    const ct = res.headers.get("Content-Type") ?? "";
    let bytes: ArrayBuffer;
    if (ct.includes("application/json")) {
      const env = (await res.json()) as CfEnvelope<{ image?: string }>;
      const b64 = env.result?.image;
      if (!env.success || !b64) {
        throw new Error(`AI image fail: ${JSON.stringify(env.errors ?? [])}`);
      }
      bytes = base64ToArrayBuffer(b64);
    } else {
      bytes = await res.arrayBuffer();
    }
    const detected = detectImage(ct, new Uint8Array(bytes));
    if (!detected) throw new Error(`Cloudflare returned non-image (${bytes.byteLength}B, ct=${ct})`);
    return { bytes, extension: detected.ext, contentType: detected.contentType };
  });
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function detectImage(
  ct: string,
  bytes: Uint8Array,
): { ext: "png" | "jpg" | "webp"; contentType: string } | null {
  const lc = ct.toLowerCase();
  if (lc.includes("png")) return { ext: "png", contentType: "image/png" };
  if (lc.includes("jpeg") || lc.includes("jpg")) return { ext: "jpg", contentType: "image/jpeg" };
  if (lc.includes("webp")) return { ext: "webp", contentType: "image/webp" };
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}
