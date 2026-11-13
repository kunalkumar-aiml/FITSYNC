# FITSYNC

**One body. Every brand. The perfect fit.** A universal fit profile that compares your body measurements with each brand’s own size chart, recommends a size, and explains why. FITSYNC is a sizing layer, not a shop.

Next.js 14 (app router) · TypeScript · Tailwind · Framer Motion · PostgreSQL · Prisma 6 · installable PWA.

## Run locally
```bash
npm install
cp .env.example .env                 # DATABASE_URL, AUTH_SECRET (32+ chars), APP_URL
npx prisma migrate deploy            # create tables
SEED_DEMO=true npm run db:seed       # categories, brands, sourced charts (unverified), 3 sample brands
npm run admin:bootstrap -- --email you@example.com   # first administrator (one time, CLI only)
npm run dev                          # http://localhost:3000
```
In development, confirmation and password-reset emails are printed to the server console (the UI says so). Configure Resend for real delivery. To run a production build over plain http on your machine: `COOKIE_SECURE=false npm start`.

## Tests
```bash
npm test                 # 132 unit tests: engine, semantics, research pipeline, security (no database)
npm run build
# integration (real PostgreSQL + running server); see the header of tests/api.integration.test.ts
TRUST_PROXY=true EMAIL_PROVIDER=outbox ALLOW_TEST_EMAIL_OUTBOX=true EMAIL_OUTBOX_DIR=/tmp/fitsync-outbox CRON_SECRET=... npx next start -p 3100 &
TEST_SERVER_URL=http://localhost:3100 EMAIL_OUTBOX_DIR=/tmp/fitsync-outbox npx vitest run tests
```
CI (`.github/workflows/ci.yml`) runs typecheck, data validation, unit tests, a schema-drift report, migrations + seed + admin bootstrap, the build, the integration suite and a dependency audit.

## What V5 changed
Security-first auth (revocable server-side sessions, Argon2id with bcrypt rehash, email verification, password reset, logout everywhere, no public admin promotion), strict CSRF, nonce-based CSP, shared rate limiting, admin audit log, dimension-specific measurement semantics (no more unknown → GARMENT / REGULAR / CM defaults), source discovery via a search API, an 11-section admin, and a complete visual redesign. Full findings: [`docs/AUDIT-V5.md`](docs/AUDIT-V5.md).

## Documentation
- [`docs/AUDIT-V5.md`](docs/AUDIT-V5.md) audit findings and status
- [`docs/SECURITY.md`](docs/SECURITY.md) identity, sessions, admin bootstrap, CSRF/CSP, rate limits
- [`docs/PRIVACY.md`](docs/PRIVACY.md) data inventory, retention, items needing owner input and legal review
- [`docs/RECOMMENDATION-ENGINE.md`](docs/RECOMMENDATION-ENGINE.md) how sizes are chosen, Fit Match Score, ease allowances
- [`docs/RESEARCH.md`](docs/RESEARCH.md) discovery, extraction, verification, coverage
- [`docs/DESIGN.md`](docs/DESIGN.md) design tokens and principles
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) GitHub + Vercel + Postgres, upgrading to V5

## Data rules (never broken)
- Charts come from sources and record them; nothing is invented. Brands without usable data say **Data unavailable**.
- Only a person can verify a chart. Imports and research results are UNVERIFIED or NEEDS_HUMAN_VERIFICATION.
- Unit, meaning (body / garment / flat width, per dimension) and garment cut are taken from the source or marked unknown; unknown is never defaulted.
- Marketplaces are not brands; a listing belongs to its product’s real brand. A verified product chart overrides the brand chart for that product.

## Project layout
`src/lib/engine` engine · `src/lib/research` pipeline · `src/lib/security` passwords, CSRF, CSP, cookies · `src/app/api` routes · `src/app` pages (`admin/*` sections) · `src/components` UI · `prisma/` schema, migrations, seed, data · `scripts/` CLI (research, admin bootstrap, cleanup) · `tests/` integration tests.

## Known limitations
- **Next.js 14 has unpatched advisories;** plan the Next 15.5+ upgrade (see audit C3).
- Brand coverage is still small: Nike tops (unverified) and three product charts with ambiguous chest/shoulder meaning.
- Ease allowances and the Fit Match Score are unvalidated until enough fit reports exist.
- PDF size guides need manual CSV import. Research jobs run inline (max 5 URLs), no background queue.
- Email change, social sign-in and MFA are not built.
- Privacy notice needs owner details and legal review before launch.
