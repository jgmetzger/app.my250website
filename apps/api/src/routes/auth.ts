import { Hono } from "hono";
import { LoginInput } from "@app/shared";
import type { AppBindings } from "../env.js";
import { buildClearCookie, buildSessionCookie } from "../lib/cookie.js";
import { signJwt, timingSafeEqual } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const authRoutes = new Hono<AppBindings>()
  .post("/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = LoginInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

    const expected = c.env.APP_PASSWORD;
    if (!expected || !timingSafeEqual(parsed.data.password, expected)) {
      // Rate-limit-friendly: same response shape, slight delay so brute-force feels lossy.
      await new Promise((r) => setTimeout(r, 250));
      return c.json({ error: "invalid_password" }, 401);
    }
    const token = await signJwt(c.env.JWT_SECRET, SESSION_TTL_SECONDS);
    c.header("Set-Cookie", buildSessionCookie(token, SESSION_TTL_SECONDS));
    return c.json({ ok: true });
  })
  .post("/logout", (c) => {
    c.header("Set-Cookie", buildClearCookie());
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, (c) => {
    return c.json({ ok: true, user: "james" });
  });
