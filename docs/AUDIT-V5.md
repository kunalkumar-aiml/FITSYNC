# FITSYNC V5 audit

Scope: the whole repository as received (Next.js 14 app router, Prisma 6 on PostgreSQL, JWT sessions, research pipeline,
admin, PWA, CI). Each finding lists severity, where it was, and what V5 did. "Open" items need a decision or a resource
outside the codebase (an API key, a legal review, a framework upgrade).

Severity: **Critical** = exploitable now with real impact · **High** = serious weakness · **Medium** = defence-in-depth or
integrity gap · **Low** = quality.

## 1. Critical security problems

| # | Finding | Where | Status |
|---|---|---|---|
| C1 | **Admin privilege escalation.** Registering (or logging in) with any address listed in `ADMIN_EMAILS` produced an ADMIN account. Email ownership was never verified, so anyone who knew or guessed the address got full admin. | `api/auth/register`, `api/auth/login`, `lib/env.ts` | **Fixed.** Public registration always creates `USER`. The login-time promotion is gone. `ADMIN_EMAILS` no longer exists. First admin: `npm run admin:bootstrap` (server-side CLI; refuses once any admin exists). Later admins: Admin → Users, which only promotes accounts with a confirmed email, never self-promotes, and keeps the last admin. Existing ADMIN rows are untouched by the migration. |
| C2 | **Sessions could not be revoked.** 7-day stateless HS256 JWT: logout only deleted the cookie; a stolen token stayed valid until expiry; no "log out everywhere"; password change could not end sessions. | `lib/session.ts` | **Fixed.** Server-side `Session` table; cookie carries 256 random bits, DB stores SHA-256 only. Idle timeout 7 days, absolute 30 days. Logout, logout-all, per-device revoke, password reset/change, account disable and admin demotion revoke sessions. Old JWT cookies are no longer accepted (holders log in again; accounts and passwords are unaffected). |
| C3 | **Next.js 14.2.35 has unpatched advisories** (RSC deserialisation DoS, rewrites request smuggling, image-optimizer DoS). Fixes exist only in Next 15.5/16. | `package.json` | **Open — top deployment risk.** Not exploitable through features FITSYNC uses for two of them (no `rewrites`, no remote `next/image`), but the RSC DoS applies. Plan: upgrade to Next 15.5+ (async `cookies()`/`headers()`/`params`) in a dedicated release and re-run the integration suite. |

## 2. Authentication weaknesses

| # | Finding | Status |
|---|---|---|
| A1 | No email verification at all. | **Fixed.** Hashed, single-use, 24 h tokens; resend is rate-limited; links require a click on the page (scanners that open links can't burn them). |
| A2 | No password reset. | **Fixed.** Generic response for unknown emails, hashed single-use 1 h tokens, previous reset tokens invalidated, all sessions revoked on success. |
| A3 | Password policy: 8 characters, no deny-list; bcrypt silently truncates after 72 bytes. | **Fixed.** Argon2id (19 MiB, t=2). 10–128 characters, common-password deny-list, no email/name, no repeats or sequences. No composition rules. bcrypt hashes keep working and are re-hashed on the next login (verified against a real legacy row). |
| A4 | Login timing revealed whether an email existed (no hash work for unknown users). | **Fixed.** A dummy Argon2 verify runs for unknown accounts; one generic message. |
| A5 | No security event log. | **Fixed.** `AuthEvent` (register, login success/failure, logout, resets, verifications, revocations, rehash). No passwords, tokens or raw IPs; IP is an HMAC with `AUTH_SECRET`. |
| A6 | Email delivery: none. | **Fixed with honest failure.** Resend over REST. Without a provider, production says plainly that emails can't be sent; development prints to the console and says so; tests use an explicit outbox that is refused on Vercel. **Open:** configure `RESEND_API_KEY` + a verified sender domain before launch. |
| A7 | Account deletion needed only a typed word. | **Fixed.** Requires the password; the last admin can't delete themselves. |

## 3. Authorization weaknesses

| # | Finding | Status |
|---|---|---|
| Z1 | Role was already read from the database (good), and each admin API handler called `requireAdmin`, but nothing tested it. | **Kept + tested.** All 18 admin handlers checked; an integration test now calls every admin route as a USER (expects 403) and anonymously (expects 401). |
| Z2 | Admin pages relied on one page-level check. | **Fixed.** Admin layout and every admin page check on the server. |
| Z3 | No object-level tests for sessions (new) and feedback. | **Fixed.** Revoking another user's session returns 404 (indistinguishable from missing); feedback for another user's recommendation 404; history and measurements scoped to the session user. All private queries take `user.id` from the session, never from the request. |
| Z4 | No audit trail for admin changes beyond chart decisions. | **Fixed.** `AdminAuditLog` for brands, products, marketplaces, chart create/import/approve/reject/flag/retire/edit, research jobs/retries/discovery, coverage notes, user role/status changes, and the CLI bootstrap. |

## 4. CSRF, rate limiting, headers, input

| # | Finding | Status |
|---|---|---|
| W1 | CSRF check only ran when `Origin` was present; a request without Origin passed. | **Fixed.** Origin must match; Referer fallback only when Origin is absent; neither → refused. Plus double-submit token (`__Host-` cookie in production + `x-csrf-token` header). No CORS headers are ever sent; preflights get an empty 204. |
| W2 | In-memory rate limiter (per instance) and limits keyed on the client-controlled `x-forwarded-for`. | **Fixed.** Upstash Redis REST limiter shared across instances, falls back to memory if Redis is down. Proxy headers are only trusted on Vercel or with `TRUST_PROXY=true`. Keys are hashed. Limits on register, login (IP + email), verify, resend, forgot, reset, password change, export, feedback, recommendations, research jobs, discovery, CSV import, admin user changes, account deletion. **Open:** provision Upstash for production (System health flags it). |
| W3 | No Content Security Policy. | **Fixed.** Per-request nonce + `strict-dynamic`; no `unsafe-inline`/`unsafe-eval` for scripts in production; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`. Verified on a production build: every `<script>` carries the nonce and pages hydrate with zero console errors in headless Chrome. `style-src 'unsafe-inline'` remains for style attributes (Framer Motion); it cannot execute code. Added COOP/CORP, tightened Permissions-Policy. |
| W4 | Body size not limited; `javascript:`/`http:` source URLs accepted by `z.string().url()` and rendered as links. | **Fixed.** 256 KB JSON cap (80 KB for CSV import), https-only URL schema for stored links, and links are re-checked before rendering. |
| W5 | Unhandled errors were logged with full objects. | **Fixed.** Responses never include stack traces; logs keep name + message only. |
| W6 | CSV export could carry spreadsheet formulas in size labels. | **Fixed.** Formula prefixes neutralised and quotes escaped. |
| W7 | Dependency advisories: Next (see C3), zod 3 (memory exhaustion on huge collections), postcss (build-time), prisma CLI dev dependency chain. | **Mitigated / open.** zod inputs are bounded (array maxima + body size cap). Audit runs in CI as a report. |

## 5. Database and data integrity

| # | Finding | Status |
|---|---|---|
| D1 | `Product.categoryId` had no foreign key; `ResearchSource.chartVersionId` and `BrandSizeChartVersion.verifiedById` were dangling-capable references. | **Fixed** in `20261114000000_v5_identity_security`: dangling refs cleared first, FKs added (`Product` FK added `NOT VALID` then validated in a guarded block so a bad legacy row can't fail the deploy). |
| D2 | **Unknown garment cut became `REGULAR`** (research job, merge, admin product form, schema defaults). | **Fixed.** `UNKNOWN` cut throughout; the engine reports `garmentCut: null`; the admin must tick “listing states this cut”. Migration corrects products/charts whose cut was never stated. |
| D3 | **Unknown measurement meaning became `GARMENT`** in the job runner and `charts.json` merge. | **Fixed.** `measurementType` can be `UNKNOWN`/`MIXED`; every dimension is then ambiguous unless a person states it. Migration relabels the affected versions (metadata only). |
| D4 | **Semantics were chart-level only**; per-dimension `measurementSemantics` was stored but ignored by the engine. | **Fixed.** The engine resolves meaning per dimension (explicit > ambiguous flag > chart type), so a chart can mix body chest with garment length. |
| D5 | **Flat widths could be compared as circumferences** if marked GARMENT. | **Fixed.** `GARMENT_WIDTH_FLAT` is never compared; an admin can convert it (×2) explicitly, which creates a new unverified version and is recorded. |
| D6 | **Unknown units defaulted to CM** in the HTML-table and marketplace adapters. | **Fixed.** Unit comes from the column label, then a statement on the page, else `UNKNOWN` → `NEEDS_HUMAN_VERIFICATION`, nothing converted or imported. CSV/manual entry must choose a unit (no default). |
| D7 | Statuses lacked `NEEDS_HUMAN_VERIFICATION` and `INVALID`; “reject” set DEPRECATED. | **Fixed.** Five statuses; only VERIFIED/UNVERIFIED are ever used for recommendations. |
| D8 | Duplicate chart versions on re-import/re-run. | **Fixed.** `createChartVersion` returns the existing version when rows, type and ambiguity are identical. |
| D9 | No distinction between missing brand data and missing product data. | **Fixed.** `BrandCoverageNote.productId` (null = brand-level), shown separately in the explorer and Data quality. |
| D10 | No retention for sessions/tokens/events. | **Fixed.** `/api/cron/cleanup` (Vercel cron, bearer `CRON_SECRET`) and `npm run db:cleanup`. |
| D11 | Body measurements: no field-level encryption. | **Open by decision.** Relies on the managed database's encryption at rest and access controls; no measurement values appear in logs, admin screens or analytics. Adding app-level encryption needs a KMS-backed key; documented in SECURITY.md. |

## 6. Broken or incomplete functionality

- `tests/api.integration.test.ts` called `/api/admin/coverage`, which never existed (the suite could not pass). Rewritten: 37 end-to-end tests now pass against a production build.
- Fit feedback created a new row every time; now one report per recommendation, editable.
- The recommend page loaded the product list for a brand whenever any product chart existed; it now only does so when the brand has product charts in the selected category.
- Research pipeline treated PDFs as "unsupported content type" without explanation; now reported clearly with the CSV-import route.
- Research "discovery" did not exist (fixed URL lists only). Added a real search-API integration (Brave or Google Programmable Search) that proposes allow-listed URLs for a person to pick; it never claims to search when unconfigured.

## 7. UI/UX and accessibility

Findings: generic dashboard look with a lavender accent; inconsistent rounded cards everywhere; `window.prompt`/`confirm` for destructive admin actions; no skip link; small low-contrast muted text; dimension analysis hidden in a sentence; no measuring guidance graphics; no session, password or account settings; admin in one long page.

Done: new identity (Ivory/Charcoal/Forest/Sage/Terracotta tokens, Instrument Serif + Instrument Sans self-hosted, tabular numerals), every page redesigned, accessible `<dialog>` confirmations with reasons, skip link, focus rings, contrast-checked tokens (body text ≥ 5.7:1, primary button 8.3:1), reduced-motion respected globally, labelled form controls, live regions for results, measurement figure for each field, per-dimension result table, 11-section admin.

Open: a screen-reader pass with real assistive technology and a keyboard-only walkthrough by a person; automated axe checks are not yet in CI.

## 8. Performance

Pages are server-rendered per request (needed for CSP nonces and personal data). Compare loads charts brand by brand (N queries); fine for ~20 brands, should become one query with an in-memory group before the catalogue grows past ~100 brands. First-load JS 87–145 kB.

## 9. Deployment risks

1. Next.js advisories (C3).
2. Email and Upstash not configured → resets impossible, limits per instance. System health shows both.
3. Migrations in this release were applied and tested with `psql` against PostgreSQL 16 (fresh database and an existing V3 database with data), because the sandbox could not download Prisma's engine binaries. CI now runs `prisma migrate diff` as a drift report; make it blocking once it passes on your repository.
4. Old JWT sessions are not accepted after deploy: every user logs in once more.
5. Brand coverage did not grow in this release: the build environment could not reach brand sites, and FITSYNC never invents charts. Use Admin → Research jobs (or `npm run research`) from a networked machine, then verify.

## 10. Outdated documentation

README referred to `ADMIN_EMAILS` and JWT sessions; DEPLOYMENT listed three env vars. Rewritten: README, DEPLOYMENT, plus new SECURITY, PRIVACY, RESEARCH and RECOMMENDATION-ENGINE documents.
