# Security design

## Identity
- **Passwords:** Argon2id (m=19456 KiB, t=2, p=1) via `@node-rs/argon2`. Legacy bcrypt hashes verify and are upgraded on the next successful login. Policy: 10–128 characters, common-password deny-list, not built from the email or name, no single repeated character or simple sequence; no composition rules. For a larger deny-list, add a k-anonymity breached-password check (e.g. Have I Been Pwned range API) in `passwordProblem`.
- **Sessions:** `Session` rows; cookie `__Host-fitsync_sid` (HttpOnly, Secure, SameSite=Lax, Path=/) with 256 random bits; DB stores SHA-256. Idle 7 days, absolute 30 days, `lastSeenAt` refreshed every 10 minutes. A new session revokes the one presented with the login request (rotation).
- **Tokens:** `AuthToken` (email verification 24 h, password reset 1 h), SHA-256 stored, single use enforced with a conditional update, bound to the address they were sent to.
- **Disabled accounts** cannot sign in and resolve to no session.

## Administrator bootstrap
`ADMIN_EMAILS` was removed (it promoted unverified addresses). Instead:
```bash
ADMIN_BOOTSTRAP_PASSWORD='a long passphrase' npm run admin:bootstrap -- --email you@yourdomain.com
# or, to promote an account you already created and control:
npm run admin:bootstrap -- --email you@yourdomain.com --promote-existing
```
Run it from a trusted machine with `DATABASE_URL` set. It refuses as soon as any ADMIN exists, so it can't be used against a running site. Afterwards use Admin → Users: only confirmed-email accounts can be promoted, nobody changes their own role, the last active admin can't be removed, and every change needs a reason and is logged.

## Authorization
`requireUser` / `requireAdmin` read the session and the user row on every request; roles are never taken from the client. Each admin route handler calls `requireAdmin` itself; the admin layout and each admin page call `requirePageAdmin`. Private queries filter by the session user id; foreign ids answer 404.

## Request security
- **CSRF:** strict Origin (Referer fallback only if Origin is absent; neither → 403) + double-submit token (`__Host-fitsync_csrf` cookie, `x-csrf-token` header). `/api/cron/*` is exempt and uses a bearer secret instead.
- **CORS:** none. No `Access-Control-Allow-*` header is ever set.
- **CSP:** nonce + `strict-dynamic` per request (middleware), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` when cookies are secure. API responses get `default-src 'none'`.
- **Other headers:** HSTS (2 years, preload), nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, COOP/CORP same-origin.
- **Rate limiting:** Upstash Redis REST (`INCR` + `PEXPIRE NX`), hashed keys, memory fallback. Client IP is only read from proxy headers on Vercel or with `TRUST_PROXY=true`.
- **Input:** every body is size-capped and validated with Zod; stored links must be https; CSV is parsed server-side with per-line errors; research URLs pass the SSRF allow-list, DNS-must-be-public check, per-hop redirect validation, robots.txt and size/time limits.
- **Errors:** generic 500 responses; logs record error name and message only.

## Personal data
Measurements are visible only to their owner. Admin screens show account metadata and aggregates, never measurements. Security logs keep keyed IP hashes, not IPs. Retention: see `src/lib/retention.ts` and `docs/PRIVACY.md`.

**Encryption at rest** is provided by the managed PostgreSQL service; confirm it for your provider. FITSYNC does not add field-level encryption today. If you add it, keep the key in a KMS or the hosting provider's secret store (never in code or `.env` committed to git), version keys so they can rotate, and encrypt only the measurement columns.

## Reporting a vulnerability
To be completed by the operator: a monitored security contact address.
