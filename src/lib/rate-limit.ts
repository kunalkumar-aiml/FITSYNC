import { ApiError } from "./api";
import { sha256 } from "./security/crypto";

/**
 * Fixed-window rate limiter.
 *
 * Production: a shared Upstash Redis store (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN), so the limit holds
 * across every serverless instance. Uses the REST API directly (no SDK): INCR + PEXPIRE NX in one pipeline.
 * Development / tests: an in-memory store. In production without Upstash the in-memory store is still used (so limits
 * slow abuse per instance), and /admin → System health shows a warning until Upstash is configured.
 * If Redis is unreachable the request falls back to the in-memory store rather than failing open completely.
 */
export type Limiter = { hit(key: string, windowMs: number): Promise<number> };

const memory = new Map<string, { count: number; resetAt: number }>();
export const memoryLimiter: Limiter = {
  async hit(key, windowMs) {
    const now = Date.now();
    const cur = memory.get(key);
    if (!cur || cur.resetAt <= now) {
      memory.set(key, { count: 1, resetAt: now + windowMs });
      if (memory.size > 10_000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      return 1;
    }
    cur.count++;
    return cur.count;
  },
};

export function upstashLimiter(url: string, token: string, fetchImpl: typeof fetch = fetch): Limiter {
  return {
    async hit(key, windowMs) {
      const res = await fetchImpl(`${url.replace(/\/+$/, "")}/pipeline`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify([["INCR", key], ["PEXPIRE", key, String(windowMs), "NX"]]),
        signal: AbortSignal.timeout(1500),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
      const out = (await res.json()) as { result?: number; error?: string }[];
      if (out[0]?.error || typeof out[0]?.result !== "number") throw new Error(`Upstash error: ${out[0]?.error ?? "bad reply"}`);
      return out[0].result;
    },
  };
}

export const rateLimitBackend = () => (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? "upstash" : "memory");

let shared: Limiter | null = null;
function limiter(): Limiter {
  if (shared) return shared;
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  shared = url && token ? upstashLimiter(url, token) : memoryLimiter;
  return shared;
}

/**
 * Throws 429 when `key` has been used more than `limit` times in the current window.
 * Keys are hashed before they reach the store, so emails never sit in Redis in clear text.
 */
export async function rateLimit(key: string, limit: number, windowMs: number, l: Limiter = limiter()) {
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `rl:${sha256(key).slice(0, 40)}:${bucket}`;
  let n: number;
  try { n = await l.hit(k, windowMs); }
  catch (e) {
    console.warn("[rate-limit] shared store unavailable, using in-memory fallback:", (e as Error).message);
    n = await memoryLimiter.hit(k, windowMs);
  }
  if (n > limit) {
    const retry = Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000);
    throw new ApiError(429, "Too many attempts. Please wait a little and try again.", { retryAfterSeconds: retry });
  }
}
