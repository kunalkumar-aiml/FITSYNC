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

## Data policy
No real brand charts are bundled. `prisma/seed.ts` lists the brands and three clearly-labelled **demo** brands with made-up numbers. Add real charts in `/admin` (CSV paste, source URL/note required to verify). Each edit is a new version; the latest *verified* version is used.

## Project layout
`src/lib/engine` engine + tests · `src/app/api` REST routes · `src/app/*` pages · `src/components` UI · `prisma/` schema, migration, seed · `tests/` API integration tests · `.github/workflows/ci.yml`.

## Known limitations
- No real verified brand charts yet (you must add them).
- No email verification or password reset (needs an email provider such as Resend; not built).
- No Google sign-in (needs OAuth credentials; not built).
- No product-URL checker or product-measurement pages; no recently-viewed list. Brand + category flow only.
- Rate limiting is in-memory per instance. Use Upstash Redis at scale.
- Error logging is `console.error` (visible in Vercel logs). Add Sentry for alerts.
- Engine ease values are unvalidated. Accuracy is unproven until you collect feedback.
- Only 4 categories (T-shirt, shirt, hoodie, jeans). Camera measurement/ML are future work.
- Privacy page is a draft, needs legal review (India DPDP Act).
- UI was verified by build, SSR smoke tests and API tests, not by manual cross-device testing. Test on a real phone.
