# FITSYNC

**One body. Every brand. The perfect fit.** A universal fit profile that compares your body measurements with brand size charts and explains which size fits.

Next.js 14 · TypeScript · Tailwind · Framer Motion · PostgreSQL · Prisma 6 · installable PWA.

## Run locally
```bash
npm install
cp .env.example .env          # fill DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS
npx prisma migrate deploy     # creates tables
npm run db:seed               # categories, brand list, 3 DEMO brands
npm run dev                   # http://localhost:3000
```
Any Postgres works (local, Neon, Supabase). Sign up with an email listed in `ADMIN_EMAILS` to get `/admin`.

## Tests
```bash
npm test                      # recommendation-engine unit tests (no DB)
npm run build && npm start &  # then, with DATABASE_URL set and ADMIN_EMAILS=admin@test.local:
TEST_SERVER_URL=http://localhost:3000 npm run test:integration
```

## How the recommendation engine works (`src/lib/engine`)
Pure TypeScript, deterministic, runs on server and in the browser.
1. Validate measurements (plausible ranges, unit sanity). 2. Everything normalised to cm.
3. Brand charts are **garment** measurements (or **body** measurements, flagged per chart). Garment size is compared with *body + ease*; body charts with a small offset.
4. Ease ranges per category and fit preference live in `config.ts`. **They are starting assumptions, not validated values.** Tune them from real feedback.
5. Per-dimension score, weighted total, ranking, tight/loose labels, confidence, plain-language explanation.
6. Missing required measurement (body or chart) returns `insufficient_data`. Nothing fits returns `no_compatible_size`. Unverified charts cap confidence at 55% and show a warning.

## Brand size data (real, sourced, never invented)
- Charts live in `prisma/data/charts.json`. Every chart records its source URL, domain, source type, extraction method, retrieval date, original unit and verification status. Rows are stored in cm; inches are converted once.
- Research output: `prisma/data/research/` → `raw/` (as read), `normalized/` (cm JSON), `csv/` (cm CSV + `.meta.json` per chart), `reports/` (coverage, missing data, failed research, source manifest, data quality, source log).
- **Everything imported is UNVERIFIED.** A human opens the source, compares, and presses Approve in `/admin`. Nothing is auto-verified.
- **BODY vs GARMENT vs product-specific** are different things. If a page does not say what a number means, that dimension is flagged **AMBIGUOUS** and is excluded from recommendations until an admin resolves it (the decision is logged).
- **Marketplaces are not brands.** Flipkart/Myntra/Nykaa Man listings are stored per product with the real brand, product name, URL and fit. There is no "Myntra size chart".
- A **verified product chart overrides** the brand chart for that product. Unverified product charts do not override a verified brand chart.
- Brands with no retrievable official table show **Data unavailable**.
- Demo (fictional) brands only exist with `SEED_DEMO=true` and are hidden in production.

### Research pipeline (`src/lib/research`)
`adapters/` (pluggable: `html-table` for official size-guide tables, `marketplace-listing` for product listings) · `extraction/` · `normalization/` · `validation/` · `ingestion/` (runner, merge/dedupe, CSV + metadata writer, reports).
Statuses: `SUCCESS`, `PARTIAL_SUCCESS`, `SOURCE_UNAVAILABLE`, `ACCESS_RESTRICTED`, `INVALID_DATA`, `NEEDS_HUMAN_VERIFICATION`.
```bash
npm run research            # live run for prisma/data/research/targets.json (your machine needs internet)
npm run research:csv        # charts.json -> csv/, metadata, normalized/, reports/
npm run research:validate   # provenance, units, duplicates, CSV round-trip (CI runs this)
npm run research:import     # charts.json -> database (idempotent, UNVERIFIED)
```
Safety: https only, allow-listed hosts (`src/lib/research/url-safety.ts`), no IPs/credentials/odd ports, DNS must resolve to public addresses, redirects re-validated, robots.txt honoured, 2 MB / 8 s limits, 401/403/429/CAPTCHA are reported as `ACCESS_RESTRICTED` and never bypassed. Admin jobs: max 5 URLs, rate limited.
Many brand sites render charts with JavaScript; the pipeline reports those as `SOURCE_UNAVAILABLE` instead of guessing.

### Adding a chart by hand (admin)
`/admin` → Charts tab (Approve / Reject / Resolve ambiguity / Deprecate / Preview CSV), Research tab (start/retry jobs), Coverage tab (filters + search), Brands & products tab, and **Import a size chart (CSV)** (accepts `size_label,chest_cm,...`, ranges, `_in` per column).

### Engine in plain words
`preferred fit` (what you want) ≠ `garment cut` (how the brand cuts it) ≠ `achieved fit` (what the size should give; unknown for body charts). The **Fit Match Score** is an experimental heuristic, not a probability, and has not been validated against real purchase/fit data.

## Project layout
`src/lib/engine` engine + tests · `src/app/api` REST routes · `src/app/*` pages · `src/components` UI · `prisma/` schema, migrations, seed, `prisma/data/charts.json` · `tests/` API integration tests · `.github/workflows/ci.yml`.

## Known limitations
- Official brand-level data exists only for Nike tops (unverified). Three marketplace product charts exist but their chest/shoulder meaning is ambiguous. Everything else is DATA UNAVAILABLE. See `docs/AUDIT-V3.md` and `prisma/data/research/reports/`.
- Ease allowances and the Fit Match Score are unvalidated until real fit feedback is collected.
- Ethnic wear and co-ord sets are not supported (no measurement mapping).
- Research jobs run inline on the server (max 5 URLs); there is no background queue.
- No email verification or password reset (needs an email provider such as Resend; not built).
- No Google sign-in (needs OAuth credentials; not built).
- No product-URL checker or product-measurement pages; no recently-viewed list. Brand + category flow only.
- Rate limiting is in-memory per instance. Use Upstash Redis at scale.
- Error logging is `console.error` (visible in Vercel logs). Add Sentry for alerts.
- Engine ease values are unvalidated. Accuracy is unproven until you collect feedback.
- Only 4 categories (T-shirt, shirt, hoodie, jeans). Camera measurement/ML are future work.
- Privacy page is a draft, needs legal review (India DPDP Act).
- UI was verified by build, SSR smoke tests and API tests, not by manual cross-device testing. Test on a real phone.
