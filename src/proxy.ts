import { NextResponse, type NextRequest } from "next/server";
import { csrfProblem, newCsrfToken } from "@/lib/security/csrf";
import { buildCsp, API_CSP } from "@/lib/security/csp";
import { CSRF_HEADER, cookiesSecure, csrfCookieName, sessionCookieName } from "@/lib/security/cookie-names";

const PROTECTED = ["/dashboard", "/profile", "/recommend", "/compare", "/history", "/settings", "/admin"];
// Machine-to-machine endpoints authenticated by a bearer secret (no cookies), so CSRF does not apply.
const CSRF_EXEMPT = ["/api/cron/"];

const json = (status: number, message: string) => NextResponse.json({ error: { message } }, { status, headers: { "content-security-policy": API_CSP } });

/**
 * Runs before every page and API request (Next 16 "proxy", formerly middleware; Node runtime).
 *  1. API: CORS is not offered (no Access-Control-Allow-* headers; preflights get an empty 204) and every
 *     state-changing request passes the CSRF check (strict Origin/Referer + double-submit token).
 *  2. Pages: a fresh CSP nonce per request, and the CSRF cookie is issued if missing.
 *  3. Protected pages without a session cookie redirect to /login. This is only a convenience: every page and API
 *     route checks the session (and role) on the server again.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204 });
    if (!CSRF_EXEMPT.some((p) => pathname.startsWith(p))) {
      const allowed = [req.nextUrl.origin, ...(process.env.APP_URL ? [process.env.APP_URL] : [])];
      const problem = csrfProblem({
        method: req.method, allowedOrigins: allowed, origin: req.headers.get("origin"), referer: req.headers.get("referer"),
        cookieToken: req.cookies.get(csrfCookieName())?.value, headerToken: req.headers.get(CSRF_HEADER),
      });
      if (problem) return json(403, problem);
    }
    const res = NextResponse.next();
    res.headers.set("content-security-policy", API_CSP);
    res.headers.set("cache-control", "no-store");
    return res;
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !req.cookies.get(sessionCookieName())?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const nonce = newCsrfToken();
  // Same switch as Secure cookies: production unless COOKIE_SECURE=false (plain-http local runs).
  const https = cookiesSecure();
  const csp = buildCsp(nonce, process.env.NODE_ENV !== "production", https);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  if (!req.cookies.get(csrfCookieName())?.value) {
    res.cookies.set(csrfCookieName(), newCsrfToken(), { httpOnly: false, secure: cookiesSecure(), sameSite: "lax", path: "/" });
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icons|fonts|favicon.ico|sw.js|manifest.webmanifest|robots.txt).*)"] };
