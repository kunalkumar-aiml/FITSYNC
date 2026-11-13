/**
 * Cookie names. Edge-safe (no Node imports) because the middleware uses them too.
 * In production the `__Host-` prefix makes the browser refuse the cookie unless it is Secure, host-only and Path=/,
 * so a sibling subdomain cannot plant or overwrite it.
 */
export const cookiesSecure = () => (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production");
export const sessionCookieName = () => (cookiesSecure() ? "__Host-fitsync_sid" : "fitsync_sid");
export const csrfCookieName = () => (cookiesSecure() ? "__Host-fitsync_csrf" : "fitsync_csrf");
export const LEGACY_SESSION_COOKIE = "fitsync_session";
export const CSRF_HEADER = "x-csrf-token";
