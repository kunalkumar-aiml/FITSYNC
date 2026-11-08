import { ApiError } from "./api";

/**
 * Simple in-memory sliding-window limiter.
 * LIMITATION: state is per server instance. On Vercel (serverless) this slows abuse but does not
 * guarantee a global limit. For production scale swap this for Upstash Redis (@upstash/ratelimit).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    throw new ApiError(429, "Too many attempts. Please wait a minute and try again.");
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
