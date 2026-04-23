// Auth sederhana: HMAC-signed cookie session, masa berlaku 7 hari.
// Hanya satu admin (password disimpan sebagai Cloudflare secret).

import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Bindings } from "../types";

const COOKIE_NAME = "resep_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 hari

interface SessionPayload {
  exp: number; // epoch ms
}

export async function createSession(c: Context<{ Bindings: Bindings }>): Promise<void> {
  const payload: SessionPayload = { exp: Date.now() + MAX_AGE_SEC * 1000 };
  const token = await sign(payload, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export function destroySession(c: Context<{ Bindings: Bindings }>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function isAuthenticated(c: Context<{ Bindings: Bindings }>): Promise<boolean> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return false;
  const payload = await verify<SessionPayload>(token, c.env.SESSION_SECRET);
  if (!payload) return false;
  return payload.exp > Date.now();
}

export const requireAuth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next: Next) => {
  if (!(await isAuthenticated(c))) {
    return c.redirect("/login");
  }
  await next();
};

// ----- HMAC sign / verify ---------------------------------------------------

async function sign(payload: object, secret: string): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(`${body}`, secret);
  return `${body}.${sig}`;
}

async function verify<T>(token: string, secret: string): Promise<T | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(body, secret);
  if (!timingSafeEq(sig, expected)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T;
  } catch {
    return null;
  }
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

function b64urlEncode(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const norm = s.replaceAll("-", "+").replaceAll("_", "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
