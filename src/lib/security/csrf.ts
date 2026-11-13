/**
 * CSRF protection for cookie-authenticated mutations. Edge-safe and pure so it can be unit-tested.
 *
 * A state-changing request to /api is accepted only when ALL of these hold:
 *  1. Origin matches the site's origin. If a browser sent no Origin, the Referer's origin must match instead.
 *     A request with neither header is refused (browsers always send at least one for cross-site POSTs).
 *  2. The x-csrf-token header equals the CSRF cookie (double-submit; the cookie is __Host- prefixed in production).
 * SameSite=Lax session cookies are a third, independent layer.
 */
export type CsrfInput = {
  method: string;
  allowedOrigins: string[];
  origin: string | null;
  referer: string | null;
  cookieToken: string | undefined;
  headerToken: string | null;
};

export const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function originOf(url: string | null): string | null {
  if (!url || url === "null") return null;
  try { return new URL(url).origin; } catch { return null; }
}

export function csrfProblem(i: CsrfInput): string | null {
  if (SAFE_METHODS.includes(i.method.toUpperCase())) return null;
  const allowed = new Set(i.allowedOrigins.map((o) => originOf(o)).filter(Boolean));
  const origin = originOf(i.origin);
  if (i.origin && i.origin !== "null") {
    if (!origin || !allowed.has(origin)) return "Cross-origin request blocked.";
  } else {
    const ref = originOf(i.referer);
    if (!ref) return "Request blocked: missing Origin and Referer.";
    if (!allowed.has(ref)) return "Cross-origin request blocked.";
  }
  if (!i.cookieToken || !i.headerToken || i.cookieToken.length < 16 || !constantTimeEqual(i.cookieToken, i.headerToken)) {
    return "Security check failed. Reload the page and try again.";
  }
  return null;
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Random token using Web Crypto (works in the Edge runtime). */
export function newCsrfToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
