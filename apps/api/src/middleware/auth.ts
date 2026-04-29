import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env.js";
import { SESSION_COOKIE, readCookie } from "../lib/cookie.js";
import { verifyJwt } from "../lib/jwt.js";

/**
 * Requires a valid session JWT in the wfbr_session cookie. Mounted on every
 * `/api/*` route except `/api/auth/login` and the unauthenticated webhooks.
 */
export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const token = readCookie(c.req.header("cookie") ?? null, SESSION_COOKIE);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const payload = await verifyJwt(c.env.JWT_SECRET, token);
  if (!payload) return c.json({ error: "unauthorized" }, 401);
  c.set("authed", true);
  await next();
};
