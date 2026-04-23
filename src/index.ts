// Entry point Cloudflare Worker.
// Routing:
//   /api/*              → public (mobile app), tanpa auth
//   /login, /logout     → auth
//   /                   → admin dashboard (perlu auth)
//   /recipes/:id        → admin detail (perlu auth)

import { Hono } from "hono";
import { logger } from "hono/logger";
import { requireAuth } from "./middleware/auth";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import type { Bindings } from "./types";

import { autoProcessDrafts } from "./service/autobot";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", logger());

app.route("/", publicRoutes);
app.route("/", authRoutes);
app.use("*", requireAuth);
app.route("/", adminRoutes);

app.notFound((c) => c.text("Not found", 404));
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.text(`Error: ${err.message}`, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: any, env: Bindings, ctx: any) {
    console.log("🔔 CRON TRIGGERED at " + new Date().toISOString());
    ctx.waitUntil(autoProcessDrafts(env));
  },
};
