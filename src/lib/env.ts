/**
 * Central place for environment-dependent settings. Nothing here grants privileges:
 * there is deliberately no ADMIN_EMAILS-style setting any more (see docs/SECURITY.md, "Administrator bootstrap").
 */
export const isProduction = () => process.env.NODE_ENV === "production";

/** Secret used for keyed hashes (IP addresses in security logs). Never used to sign sessions (sessions are server-side). */
export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (isProduction()) throw new Error("AUTH_SECRET must be set (min 32 chars)");
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-0123456789");
  }
  return new TextEncoder().encode(s);
}

/** Secure cookies everywhere except local development. COOKIE_SECURE=false lets you run `next start` over plain http locally. */
export { cookiesSecure as cookieSecure } from "./security/cookie-names";

/** Public origin of the site, used in email links. Falls back to the request origin. */
export function appUrl(fallback?: string): string {
  const v = process.env.APP_URL?.replace(/\/+$/, "");
  if (v) return v;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return fallback ?? "http://localhost:3000";
}
