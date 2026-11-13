# FITSYNC V6 audit and fixes (2026-11-14)

Branch `fix/production-readiness`, on top of `c023108 Upgrade FITSYNC to V5`.
Everything below was run locally against PostgreSQL 16 with the repository's own migrations.

## 1. Registration error: root cause

"Something went wrong on our side. Please try again." at sign-up was reproduced locally in two ways. Both match a production deployment that is missing a setting:

| Cause | How it failed | Evidence |
|---|---|---|
| `AUTH_SECRET` missing in production | On Vercel, `VERCEL=1` makes the client IP trusted, so `startSession` hashes it with `AUTH_SECRET`. That threw after the user row had been created. | First attempt returned 500. The retry returned 409 "account already exists", because the orphan account was left behind. |
| Migrations not applied (`prisma migrate deploy` never ran against the production database) | V5 code queried columns that did not exist (Prisma P2022). | Every attempt returned 500. |

The Vercel build (`npm run build`) does not run migrations. They only run from CI when the `PRODUCTION_DATABASE_URL` secret is set and every check passes.

**Fixes**
- `src/app/api/auth/register/route.ts`: the account, its profile and its first session are now one nested create. Everything that can fail runs before that write, so a half-created account can no longer exist. A failure to send the verification email no longer fails the sign-up.
- `src/lib/readiness.ts` + `/api/health`: the health check now returns 503 with problem codes (`AUTH_SECRET_MISSING`, `DATABASE_SCHEMA_OUTDATED`, `DATABASE_UNREACHABLE`, `DATABASE_URL_MISSING`) instead of "ok". It never returns values.
- `src/lib/api.ts`: unexpected errors are now classified, and each class gets its own message with a log reference:

  | Class | Status | Message |
  |---|---|---|
  | Configuration | 503 | "temporarily unavailable because of a server configuration problem" |
  | Database unreachable | 503 | |
  | Schema behind | 503 | "finishing an update" |
  | Unique-constraint race | 409 | |
  | Anything else | 500 | Includes a reference ID |

  The server log line carries the same reference. Stack traces, SQL and secrets are never sent to users.
- Register and login refuse early, and say why in the server log, when the deployment is misconfigured.

After the fix, both scenarios above return 503 with a clear message and create no account rows. With correct configuration, registration returns 201 and the user is signed in.

## 2. Brand Explorer "Data unavailable": root cause

The data is genuinely missing. The code is not hiding it.
- Records in the dev database after `db:seed`: 14 real brands, 8 charts. Every chart is UNVERIFIED, and no chart has ever been verified.
- 11 of the 14 brands had no chart at all. The API, the explorer filters and the gender, region and category logic were checked; none of them hides valid records.
- 17 brands in production most likely means 14 real brands plus the 3 demo brands (`SHOW_DEMO_BRANDS`). This is an inference: the production database was not inspected.

**Research on 2026-11-14 (official sources only)**

| Brand | Result |
|---|---|
| adidas | **Added**: men's Shirts & Tops body chart, XS–3XL, chest/waist/hip in cm, from https://www.adidas.com/us/help/size_charts. Region US, UNVERIFIED. |
| Nike | Already had 4 official T-shirt charts (men/women, Global/Asia). Unchanged. |
| PUMA | Official guide has only DE/UK/US conversion tables. Unavailable. |
| H&M | Official size-guide pages (India and US) have no readable table. Unavailable. |
| Zara | Says its guide is per product page. Unavailable. |
| UNIQLO | Charts are per product page. Unavailable. |
| Levi's | levi.in product pages show size labels without measurements; the global guide refused the fetch. Unavailable. |
| Snitch, The Souled Store | Size-chart pages returned no readable table. Unavailable. |
| Bewakoof, Westside | The sites refused the fetch. Unavailable. |
| Max Fashion, Savana, Arbour | Not re-researched this round. Status unchanged. |

Every attempt is recorded in `prisma/data/research/reports/source-log.json` and imported as a `ResearchSource`. Coverage notes now say why each brand is unavailable, and the explorer card shows that reason.

**Totals:** 9 brands researched this round, 1 new official chart. Repository total: 8 charts (5 official brand-level, 3 product-level), **0 verified, 8 unverified**. Nothing was auto-verified. An administrator must check each chart against its source in /admin and press Verify.

## 3. Test results

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| Unit tests (`npm test`) | 138 / 138 pass, including 5 new readiness/error tests and the adidas engine tests |
| Integration tests (`vitest run`, running server + real Postgres) | 177 / 177 pass |
| `npm run research:validate` | 8 charts, 0 errors |
| `npm run build` | Pass |
| `node scripts/e2e-journey.mjs` (15-step journey) | 15 / 15 pass |
| ESLint | **Not configured** in this repository (no eslint dependency or config) |

The integration suite already covered these, and all pass:
- Sign-up, duplicates, login, logout, session revocation and IDOR, logout-all
- Password reset and change, email verification
- Measurements, inch-to-cm conversion, recommendations and determinism, compare, feedback IDOR
- Admin 401/403, CSRF, rate limiting, cron secret
- Export without secrets, account deletion

New test: registration signs the user in and rotates any session cookie sent with it.

## 4. Security checks (no new vulnerabilities found in app code)

Checked and confirmed:
- Argon2id password hashing (with bcrypt upgrade on login)
- Server-side SHA-256 hashed sessions with idle and absolute expiry
- CSRF: Origin check plus double-submit token
- `__Host-` secure cookies in production, nonce-based CSP
- No raw unsafe SQL, no user-controlled HTML sinks
- SSRF allowlist for research fetching
- Admin routes enforce role on the server
- No `.env` committed

**Dependency advisories** (`npm audit --omit=dev`): next 14.2.35 (critical, DoS), zod 3 (high, memory on oversized collections; bodies are capped at 256 KB), prisma CLI/deepmerge-ts (high, dev tooling), postcss (via next). Every fix is a **major** upgrade (Next 16, Zod 4, Prisma 7). They were not applied automatically because they need a separate migration and regression pass.

## 5. Blockers and limits

- Prisma's engine download host (binaries.prisma.sh) was blocked in this environment. Migrations were applied with `psql` from the committed `migration.sql` files, so `prisma migrate deploy` itself was not executed here. Run it against Neon as below.
- Resend email delivery was not tested: no `RESEND_API_KEY` is available. The test outbox provider was used, and the UI already says plainly when email is not configured.
- The production database and Vercel project were not accessed. The causes in section 1 are the two reproduced failure modes. Confirm which one applies with `/api/health` (below).
- Many Indian brand sites render size charts with JavaScript or block automated fetches. They need a person to copy the chart from the official site into Admin → Size charts (CSV import), with the source URL.

## 6. Deploying this fix (Vercel + Neon)

1. In Vercel → Settings → Environment Variables, confirm `DATABASE_URL`, `AUTH_SECRET` (32+ characters) and `APP_URL` are set for Production.
2. From a laptop:
   ```bash
   DATABASE_URL="<neon url>" npx prisma migrate deploy
   DATABASE_URL="<neon url>" npm run db:seed
   ```
   Both are additive and idempotent. They never reset data.
3. Deploy, then open `https://<domain>/api/health?fresh=1`. It must say `"status":"ok"`. If it lists problem codes, fix those first.
4. Run the journey against production with a throwaway account. It deletes the account it creates:
   ```bash
   node scripts/e2e-journey.mjs https://<domain>
   ```
5. In /admin, verify the adidas chart against its source URL.
