/**
 * Content Security Policy. Edge-safe.
 * Scripts: only those carrying this request's nonce, plus what they load ('strict-dynamic'). No 'unsafe-inline' and,
 * outside development, no 'unsafe-eval' for scripts. Next.js reads the nonce from the request's CSP header and adds it
 * to its own <script> tags; our one inline script (theme) reads it from the x-nonce header.
 * Styles: 'unsafe-inline' is kept for style attributes only (Framer Motion and Next set inline styles); it cannot run code.
 */
export function buildCsp(nonce: string, dev = process.env.NODE_ENV !== "production", https = !dev) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // only over https: on a plain-http local `next start` it would rewrite asset URLs to https and break the page
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
