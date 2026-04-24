import { Hono } from "hono";
import type { Bindings } from "../types";
import { createSession, destroySession, isAuthenticated } from "../middleware/auth";
import { loginView } from "../views/login";

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.get("/login", async (c) => {
  if (await isAuthenticated(c)) return c.redirect("/admin");
  return c.html(loginView());
});

authRoutes.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const password = String(form.password ?? "");
  if (!c.env.ADMIN_PASSWORD) {
    return c.html(loginView("ADMIN_PASSWORD belum di-set di Cloudflare secret."), 500);
  }
  if (password !== c.env.ADMIN_PASSWORD) {
    return c.html(loginView("Password salah."), 401);
  }
  await createSession(c);
  return c.redirect("/admin");
});

authRoutes.post("/logout", (c) => {
  destroySession(c);
  return c.redirect("/login");
});
