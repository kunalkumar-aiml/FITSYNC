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
| Name | Value |
|---|---|
| `DATABASE_URL` | connection string from step 2 |
| `AUTH_SECRET` | output of `openssl rand -base64 48` |
| `ADMIN_EMAILS` | your email (becomes admin on signup) |

## 4. Run migrations + seed (once, from your laptop)
```bash
DATABASE_URL="<prod url>" npx prisma migrate deploy
DATABASE_URL="<prod url>" npm run db:seed
```
After this, migrations run automatically from CI (step 8).

## 5. Connect Vercel
vercel.com → Add New → Project → import the repo → Framework: Next.js (auto) → add the 3 env vars → Deploy.

## 6. Custom domain
Vercel → Project → Settings → Domains → add `yourdomain.in`; set the DNS records Vercel shows at your registrar. HTTPS is automatic.

## 7. Verify the live site
1. `https://<domain>/api/health` returns `{"data":{"status":"ok"...}}`.
2. Sign up with your admin email; `/admin` loads.
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
