// Content safety gate untuk demand-driven generation (Google Play Generative AI policy).
// Layer pertahanan berlapis:
//   1. Query validation — tolak input yang tidak terlihat seperti nama makanan.
//   2. Prompt hardening — system prompt sudah tolak non-food (lihat prompts.ts).
//   3. Post-generation validator — tolak output dengan kata kunci kesehatan/medis.
//
// Semua pemeriksaan murni string matching, tidak pakai LLM tambahan → gratis dan deterministik.

import type { GeneratedRecipeContent } from "../types";

/**
 * Keyword yang LANGSUNG block di sisi query. Case-insensitive. Berfokus kategori yang
 * paling berisiko Google Play policy: NSFW, kekerasan, obat/narkoba, klaim medis.
 */
const QUERY_BLOCKLIST: readonly string[] = [
  // NSFW / dewasa
  "porn", "sex", "seks", "telanjang", "bugil", "nude", "erotic", "bdsm",
  // Kekerasan / senjata
  "bomb", "bom ", "senjata", "gun", "pistol", "bunuh", "pembunuh", "knife attack",
  // Narkoba / zat terlarang
  "narkoba", "ganja", "cocaine", "heroin", "sabu", "meth", "ekstasi", "ecstasy",
  "opium", "mariyuana", "marijuana", "weed brownies",
  // Klaim medis — bukan ranah resep
  "obat ", "penyembuh", "menyembuhkan", "terapi ", "chemotherapy",
  "penangkal", "penawar racun",
  // Hate speech / diskriminasi
  "hitler", "nazi", "genosida", "rasis",
  // Self-harm
  "bunuh diri", "suicide", "self harm",
];

/**
 * Pattern whitelist: kalau query match salah satu pattern ini, anggap valid makanan.
 * Fallback: query yang tidak match blocklist juga diterima (kita permisif di sini dan
 * andalkan system prompt AI untuk filter lanjutan).
 */
const MIN_QUERY_LEN = 3;
const MAX_QUERY_LEN = 80;

export interface SafetyResult {
  ok: boolean;
  reason?: string;
}

export function validateFoodQuery(rawQuery: string): SafetyResult {
  const q = rawQuery.toLowerCase().trim();
  if (q.length < MIN_QUERY_LEN) {
    return { ok: false, reason: "Query terlalu pendek (min 3 karakter)." };
  }
  if (q.length > MAX_QUERY_LEN) {
    return { ok: false, reason: "Query terlalu panjang (max 80 karakter)." };
  }
  if (!/[a-z]/.test(q)) {
    return { ok: false, reason: "Query harus mengandung huruf." };
  }
  for (const bad of QUERY_BLOCKLIST) {
    if (q.includes(bad)) {
      return { ok: false, reason: "Query mengandung kata kunci terlarang." };
    }
  }
  return { ok: true };
}

/**
 * Pattern yang dianggap health claim — auto-reject kalau muncul di description atau steps.
 * Ini bukan untuk mencegah info gizi umum ("kaya protein") tapi klaim medis spesifik
 * yang melanggar Google Play Health Misinformation + Misleading Claims policies.
 */
const HEALTH_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bmenyembuhkan\b/i,
  /\bobat\s+(untuk|alami)\b/i,
  /\bmengobati\s+(penyakit|kanker|diabetes|jantung|tekanan\s+darah)\b/i,
  /\bterapi\s+(medis|kanker|diabetes)\b/i,
  /\bpenangkal\s+(racun|virus|penyakit)\b/i,
  /\bmenggantikan\s+(obat|resep\s+dokter)\b/i,
  /\bcures?\s+(cancer|diabetes|disease)\b/i,
];

/**
 * Validasi hasil generate AI — reject kalau output mengandung klaim medis/kesehatan.
 * Kalau output string kosong / tidak masuk akal, juga reject.
 */
export function validateGeneratedContent(
  content: GeneratedRecipeContent,
): SafetyResult {
  if (!content.description || content.description.length < 20) {
    return { ok: false, reason: "Description terlalu pendek — kemungkinan bukan resep valid." };
  }
  if (content.ingredients.length === 0 || content.steps.length === 0) {
    return { ok: false, reason: "Bahan atau langkah kosong — output AI tidak valid." };
  }

  const haystack = [
    content.description,
    ...content.steps.map((s) => s.instruction),
  ].join(" ");

  for (const pattern of HEALTH_CLAIM_PATTERNS) {
    if (pattern.test(haystack)) {
      return {
        ok: false,
        reason: "Konten mengandung klaim kesehatan/medis yang tidak diperbolehkan.",
      };
    }
  }

  return { ok: true };
}
