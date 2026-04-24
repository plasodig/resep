// Rate limiter berbasis KV. Key pola: "rl:<bucket>:<ip>" → counter, TTL = window detik.
// Worker KV punya eventual consistency ~60s antar region, jadi burst kecil bisa bypass batas
// untuk window pendek — tapi ini acceptable untuk use case kita (bukan anti-abuse level ketat,
// cuma pagar supaya tidak drain quota AI).

import type { Context, MiddlewareHandler } from "hono";
import type { Bindings } from "../types";

export interface RateLimitRule {
  /** Key bucket untuk membedakan endpoint (mis. "suggestions", "requests"). */
  bucket: string;
  /** Maksimum request per IP per window. */
  limit: number;
  /** Window dalam detik (KV expirationTtl minimum 60). */
  windowSec: number;
}

/**
 * Middleware rate limit per-IP. Saat terlampaui → 429 + retryAfter.
 * Kalau IP tidak terdeteksi (dev/local), fallback ke "unknown" — shared bucket,
 * tidak ideal tapi aman untuk testing.
 */
export function rateLimit(rule: RateLimitRule): MiddlewareHandler<{ Bindings: Bindings }> {
  return async (c, next) => {
    const ip = clientIp(c) ?? "unknown";
    const key = `rl:${rule.bucket}:${ip}`;
    const current = await c.env.IMAGES.get(key);
    const count = current ? parseInt(current, 10) || 0 : 0;
    if (count >= rule.limit) {
      c.header("Retry-After", String(rule.windowSec));
      return c.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: `Terlalu banyak permintaan. Coba lagi dalam ${rule.windowSec} detik.`,
          limit: rule.limit,
          windowSec: rule.windowSec,
        },
        429,
      );
    }
    // Pastikan TTL minimum 60s (batas KV).
    const ttl = Math.max(60, rule.windowSec);
    await c.env.IMAGES.put(key, String(count + 1), { expirationTtl: ttl });
    await next();
  };
}

export function clientIp(c: Context<{ Bindings: Bindings }>): string | null {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
