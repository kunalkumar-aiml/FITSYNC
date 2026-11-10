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
- Charts live in `prisma/data/charts.json` and are loaded by `npm run db:seed`. Every chart records its **official source URL**, source type, original unit and retrieval date. Rows are stored in cm; inches are converted on seed/import.
- Seeded charts are **UNVERIFIED**. A human opens the source URL, compares, and clicks **Verify** in `/admin`. Nothing is ever auto-verified. Verified charts lift the confidence cap.
- Brands with no retrievable official table are recorded as **DATA UNAVAILABLE** (with the reason). They are shown separately in Compare and never get an invented size.
- Charts are separated by **gender** (men's / women's / unisex), **region** (IN, GLOBAL, ASIA, ...), **product line** and the garment's **cut**. Men's and women's are never mixed. Body-measurement charts (ranges) and garment-measurement charts are handled differently by the engine.
- Demo brands (fictional numbers) are only created with `SEED_DEMO=true`, are typed `DEMO`, and are hidden when `NODE_ENV=production` unless `SHOW_DEMO_BRANDS=true`.

### Adding more brands (admin)
`/admin` → **Import a size chart (CSV)**. Copy the table from the brand's size guide, e.g.
```
label,chest,waist,hips
S,35-37.5,29-32,35-37.5
M,37.5-41,32-35,37.5-41
```
Pick brand, category, men's/women's, region, whether numbers describe the body or the garment, the source's unit and source URL. Use **Validate & preview** first. Open-ended values (`<31`, `51.5+`) are rejected on purpose. Each import becomes a new unverified version; old versions are kept.

### Engine inputs, in plain words
`preferred fit` (what you want) is separate from `garment cut` (how the brand cuts that garment) and `achieved fit` (what the recommended size should actually give, judged from garment ease; unknown for body-measurement charts). If a brand only sells a relaxed cut and you want slim, you are told no size fits, rather than getting a bad pick.

## Project layout
`src/lib/engine` engine + tests · `src/app/api` REST routes · `src/app/*` pages · `src/components` UI · `prisma/` schema, migrations, seed, `prisma/data/charts.json` · `tests/` API integration tests · `.github/workflows/ci.yml`.

## Known limitations
- Only Nike (tops) has official charts so far, and they are unverified until you verify them. All other brands are DATA UNAVAILABLE until charts are added.
- No email verification or password reset (needs an email provider such as Resend; not built).
- No Google sign-in (needs OAuth credentials; not built).
- No product-URL checker or product-measurement pages; no recently-viewed list. Brand + category flow only.
- Rate limiting is in-memory per instance. Use Upstash Redis at scale.
- Error logging is `console.error` (visible in Vercel logs). Add Sentry for alerts.
- Engine ease values are unvalidated. Accuracy is unproven until you collect feedback.
- Only 4 categories (T-shirt, shirt, hoodie, jeans). Camera measurement/ML are future work.
- Privacy page is a draft, needs legal review (India DPDP Act).
- UI was verified by build, SSR smoke tests and API tests, not by manual cross-device testing. Test on a real phone.
