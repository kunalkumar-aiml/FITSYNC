# Deployment guide (GitHub + Vercel + Postgres)

## 1. Create the GitHub repository
On github.com: New repository → `fitsync` → Private (or Public) → no README/license (we have them).
```bash
cd fitsync
git init -b main            # skip if already a repo
git add -A && git commit -m "Initial FITSYNC"
git remote add origin https://github.com/<you>/fitsync.git
git push -u origin main
```

## 2. Production database
Create a free Postgres at [neon.tech](https://neon.tech) (or Supabase). Copy the connection string (must include `sslmode=require`). Pick a region near your users (Mumbai/Singapore).

## 3. Environment variables
| Name | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | connection string from step 2 |
| `AUTH_SECRET` | yes | output of `openssl rand -base64 48` |
| `APP_URL` | yes | `https://yourdomain.in` (email links, CSRF origin) |
| `RESEND_API_KEY`, `EMAIL_FROM` | for launch | Resend key and a sender on a domain you verified in Resend. Without them, verification and reset emails are not sent (the site says so). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | strongly recommended | Upstash Redis (free tier is enough to start) for rate limits shared across instances |
| `CRON_SECRET` | recommended | 16+ random characters; Vercel cron sends it to `/api/cron/cleanup` daily |
| `SEARCH_PROVIDER` + key | optional | source discovery for admins (docs/RESEARCH.md) |

`ADMIN_EMAILS` no longer exists. Remove it from Vercel if it is set.

## 4. Run migrations + seed + first administrator (once, from your laptop)
```bash
DATABASE_URL="<prod url>" npx prisma migrate deploy
DATABASE_URL="<prod url>" npm run db:seed
DATABASE_URL="<prod url>" npm run admin:bootstrap -- --email you@yourdomain.in   # asks for a password
```
The bootstrap refuses once any administrator exists.
After this, migrations run automatically from CI (step 8).

## 5. Connect Vercel
vercel.com → Add New → Project → import the repo → Framework: Next.js (auto) → add the 3 env vars → Deploy.

## 6. Custom domain
Vercel → Project → Settings → Domains → add `yourdomain.in`; set the DNS records Vercel shows at your registrar. HTTPS is automatic.

## 7. Verify the live site
1. `https://<domain>/api/health` returns `{"data":{"status":"ok"...}}`.
2. Log in with the administrator you bootstrapped; `/admin` loads and Admin → System health shows no "Action needed".
3. Add a real size chart in Admin (CSV + source), click Verify.
4. Add measurements, run Find your size and Compare; check results and the Verified badge.
5. On Android Chrome: menu → Install app. On iPhone Safari: Share → Add to Home Screen.
6. Settings → download data, delete a test account.

## 8. Automatic updates via GitHub
`git push` → GitHub Actions (`ci.yml`) runs typecheck, unit tests, migrations on a throwaway DB, build, integration tests → Vercel builds and deploys.
- Add GitHub secret `PRODUCTION_DATABASE_URL` (repo → Settings → Secrets → Actions). On pushes to `main` that pass checks, CI runs `prisma migrate deploy` on production.
- To make Vercel deploy only checked code: work on branches, open PRs, protect `main` (Settings → Branches → require the `check` status), merge to deploy. PRs get Vercel preview URLs automatically. Point previews at a separate database.

## 9. Rollback
- Code: Vercel → Deployments → pick last good one → **Promote to Production** (instant), then `git revert` the bad commit.
- Database: migrations are forward-only. Use the *expand/contract* pattern: add columns/tables first (old code keeps working), deploy code, remove old columns in a later release. Never rename/drop in the same release as code that depends on it. Neon supports point-in-time restore; take a branch/snapshot before risky migrations.
- Create migrations locally with `npx prisma migrate dev --name what_changed`, commit the generated folder.

## 10. Updating an existing deployment with the real-brand-data release
```bash
git pull   # or copy the updated files over your project folder
npm install
npx prisma migrate deploy      # additive migration 20261109000000_real_brand_data; keeps users, measurements, history
npm run db:seed                # adds sourced charts (UNVERIFIED) + "data unavailable" notes; safe to repeat
git add -A && git commit -m "Real brand size data, gender/region charts, CSV import" && git push
```
Then open `/admin`, check each chart against its source URL, and press **Verify**.
Demo brands are hidden on Vercel automatically. Set `SHOW_DEMO_BRANDS=true` only if you want them visible.

## 11. V3 update (products, marketplaces, research pipeline)
```bash
npm install
npx prisma migrate deploy       # 20261110000000_v3_research_products (additive; keeps users, measurements, history)
npm run db:seed                 # idempotent; adds Savana, marketplaces, product charts, research sources (UNVERIFIED)
npm run research:validate       # optional local check
git add -A && git commit -m "FITSYNC V3" && git push
```
Routine for new data: `npm run research` (or Admin → Research) → review in Admin → Charts → Approve. Update the DB with `npm run research:import` or push (seed). Demo brands stay hidden on Vercel.

## 12. V5 update (security, data integrity, redesign)
Before deploying: set `APP_URL`, `RESEND_API_KEY` + `EMAIL_FROM`, Upstash, and `CRON_SECRET` in Vercel; remove `ADMIN_EMAILS`.
```bash
npm install
npx prisma migrate deploy        # 20261114000000_v5_identity_security (additive; keeps users, measurements, history, admins)
npm run db:seed                  # idempotent
git add -A && git commit -m "FITSYNC V5" && git push
```
What users notice: everyone is signed out once (old JWT sessions are not accepted) and logs in again with the same
password; bcrypt passwords are upgraded to Argon2id on that login. Existing accounts are asked to confirm their email.
Existing administrators stay administrators. If you had relied on `ADMIN_EMAILS` and have no ADMIN row yet, run
`npm run admin:bootstrap -- --email ... --promote-existing` for the account you control.

The migration also relabels data that had been given false defaults: product charts whose cut was never stated become
`UNKNOWN` (not REGULAR), and chart versions whose every measurement was ambiguous become type `UNKNOWN` (not GARMENT).
Measurement rows are not modified.

After deploying: open Admin → System health and fix anything marked "Action needed"; then work through Admin → Source
verification.
