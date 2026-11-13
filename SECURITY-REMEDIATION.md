# Security remediation: dependency vulnerabilities (FITSYNC V6)

Branch: `security-remediation`, based on `fix/production-readiness-v6` (head `0c8c7fa`).
Scope: the six `npm audit` findings reported by GitHub Actions. No application features, database schema or migrations were changed.

## 1. Original vulnerabilities

`npm audit --omit=dev` on the V6 head reported **6 vulnerabilities (5 high, 1 critical)**. The report you received named three packages (rows 1 to 3); rows 4 to 6 are the Prisma CLI chain, which `npm audit` groups separately.

| # | Package | Severity | Installed | Dependency path | Advisories |
|---|---------|----------|-----------|-----------------|------------|
| 1 | `next` | **Critical** | 14.2.35 | direct (`dependencies`) | 25 advisories, e.g. CSP-nonce XSS (GHSA-ffhc-5mcf-pf4q), RSC/Server Action DoS, middleware/proxy redirect cache poisoning (GHSA-3g8h-86w9-wvmq), request smuggling in rewrites, Image Optimizer RCE/DoS, cache poisoning/confusion |
| 2 | `postcss` | High | 8.4.31 (nested in `next`) | `next` → `postcss` | 4 advisories: `</style>` XSS in stringify output, arbitrary `.map` file read via `sourceMappingURL` (GHSA-qx2v-qp2m-jg93, -6g55-p6wh-862q, -fxqj-rqcc-2cmp, -r28c-9q8g-f849) |
| 3 | `zod` | High | 3.25.76 (spec `^3.23.8`) | direct | Memory exhaustion on oversized constrained collections (GHSA-mrhx-c7xc-m3w5), fixed in 4.6.6 |
| 4 | `deepmerge-ts` | High | 7.1.5 | `prisma` (devDep, peerOptional of `@prisma/client`) → `@prisma/config` → `deepmerge-ts` | Stack exhaustion on recursive objects (GHSA-ggr8-5vv4-36mx), fixed in 8.0.0 |
| 5 | `@prisma/config` | High (transitive) | 6.19.3 | `prisma` → `@prisma/config` | inherits #4 |
| 6 | `prisma` | High (transitive) | 6.19.3 | direct (`devDependencies`) | inherits #4 |

Note that the top-level `postcss` (used by Tailwind, `8.5.32`) was already patched; only the copy bundled inside Next was vulnerable.

## 2. Versions after remediation

| Package | Before | After | How |
|---------|--------|-------|-----|
| `next` | 14.2.35 | **16.4.6** (exact) | upgraded via 15.5.29 as an intermediate step |
| `postcss` (inside Next) | 8.4.31 | **8.5.23** | comes with Next 16.4.6 |
| `zod` | ^3.23.8 (3.25.76) | **^4.6.7** (4.6.7) | direct upgrade |
| `deepmerge-ts` | 7.1.5 | **8.0.2** | scoped `overrides` for `@prisma/config` only |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 6.19.3 | 6.19.3 (unchanged) | see section 5 |
| `react`, `react-dom` | 18.3.1 | 18.3.1 (unchanged) | still supported by Next 16 (see section 7) |
| Node `engines` | `>=20` | `>=20.9.0` | Next 16 minimum |

`deepmerge-ts@8.0.2` was published 2026-08-21, well over two weeks before this change.

## 3. Upgrade strategy

Four commits, each tested on its own so any one can be reverted or bisected:

1. `9fd7faf` Zod 3 → 4 (isolated; no other package depends on Zod).
2. `d37080e` Next 14 → 15.5.29 plus the async request API migration. Not a security fix by itself; it makes the Next 16 step small and the failures attributable.
3. `561ab52` Next 15 → 16.4.6 (config key, tsconfig). `middleware.ts` still unchanged here.
4. `935dee5` `middleware.ts` → `proxy.ts`, as a separate commit because it is the only change that moves security-critical code (CSRF, CSP nonce) to a different runtime.

Then the `deepmerge-ts` override, the `engines` bump and this document.

`npm audit fix --force` was not used, and no audit step was removed or silenced.

## 4. Breaking changes and what was done about each

### Next.js 14 → 16

| Breaking change | Impact on FITSYNC | Fix |
|-----------------|-------------------|-----|
| `cookies()`, `headers()`, `params`, `searchParams` are async (compat shim removed in 16) | 6 server pages/layout, `csrf` route, `session.ts`, **11 route handlers** | Official codemod (`next-async-request-api`) handled pages, layout and the CSRF route. It **cannot** see handlers wrapped in `route(async (req, { params }) => …)` and left temporary `UnsafeUnwrappedCookies` casts in `session.ts`, so those were migrated by hand. |
| Helpers made async ripple into callers | `readToken`, `setSessionCookie`, `clearSessionCookies` are now `async`; 5 call sites | Every call site now `await`s. This is the riskiest part of the migration because a forgotten `await` is not a type error and would silently skip setting/clearing a session cookie. All calls were checked by grep, and the E2E journey (login, logout, session rotation, delete account) and the integration tests exercise them. |
| `experimental.serverComponentsExternalPackages` removed | Native module `@node-rs/argon2` would have been bundled and failed at runtime | Moved to top-level `serverExternalPackages`. Build reported the old key as invalid before the change. |
| `middleware.ts` deprecated in favour of `proxy.ts` (Node runtime) | CSRF, CORS preflight, CSP nonce, login redirect | Renamed file and exported function. Logic untouched. Verified end to end (section 6). |
| Turbopack is the default bundler | Build output differs | Build passes; no custom webpack config existed. |
| `tsconfig`: `jsx: react-jsx`, `.next/dev/types` | Auto-edited by Next on build | Committed the two required values only (kept the original formatting) so builds no longer rewrite the file. |
| `next lint` removed | Project does not use it | None needed. |
| React 18 support deprecated | Build prints a deprecation warning | Not changed (section 7). |

Not used by the codebase (checked by search): Pages Router, i18n, rewrites, custom webpack, Server Actions (`"use server"`), `revalidateTag`/`revalidatePath`, edge-runtime route exports, parallel routes. `next/image` is used in one component and no `images`/`remotePatterns` config exists, so the Image Optimizer advisories may have applied to this app; they are fixed by the upgrade either way.

### Zod 3 → 4

| Breaking change | Where | Fix |
|-----------------|-------|-----|
| `errorMap` option removed | `adminUserUpdateSchema.confirm` | `z.literal(true, { error: () => "Confirm this change." })` |
| `required_error` removed | `chartVersionSchema.fitCut`, `.originalUnit` | `{ error: (iss) => iss.input === undefined ? "<message>" : undefined }`, which keeps "custom message only when missing, library message when invalid" |
| **`z.record(enumKey, …)` became exhaustive** (every key required) | `editVersionSchema.resolveSemantics` | `z.partialRecord(...)`. This compiles without error under Zod 4 but would have rejected every admin request that resolves a single ambiguous dimension. |
| `ZodError.flatten()` deprecated | `handleError` in `src/lib/api.ts` | `z.flattenError(e).fieldErrors` (same response shape) |
| `ZodTypeAny` deprecated | `parseBody` | `z.ZodType` |

Known, intentional difference: Zod 4 changed the wording of its **built-in** messages (for example for a missing required field). Custom messages are unchanged. No test or client code in the repository depends on the built-in wording, but external API consumers (if any) would see different text in `error.details`. The `details` object keeps the same shape (field name → array of messages).

### Prisma / deepmerge-ts

See section 5.

## 5. Prisma decision

The fixed `deepmerge-ts` (8.x) ships with Prisma 7 (`@prisma/config@7.10.1` depends on `deepmerge-ts@8.0.2`). Prisma 7 is a major migration: the datasource URL moves out of `schema.prisma` into `prisma.config.ts`, environment loading changes, and `migrate deploy` (used by `vercel.json`/CI and the `migrate-production` job) behaves differently. That could not be validated here (see section 8), and the vulnerable code runs only inside the Prisma **CLI** at build/migrate time, never in the application runtime.

Instead of a blind major bump, `deepmerge-ts` is overridden to 8.0.2 only for `@prisma/config`:

```json
"overrides": { "@prisma/config": { "deepmerge-ts": "8.0.2" } }
```

Checked against that combination: `deepmerge` export exists in 8.0.2; `prisma validate`, `prisma generate` succeed; loading a `prisma.config.ts` (the only code path that calls `deepmerge`) succeeds; the whole app build, integration tests and E2E pass.

Trade-off: this pairing is not one Prisma itself tested. Remove the override once `@prisma/config` 6.x/7.x ships with `deepmerge-ts >= 8`, or move to Prisma 7 as its own PR.

## 6. Test results

Same environment and database for before/after. "Before" = V6 head `0c8c7fa`.

| Check | Before | After |
|-------|--------|-------|
| `npm ci` (clean `node_modules`) | pass | pass |
| `npm run typecheck` | pass | pass |
| `npm test` (unit) | 138 passed | **159 passed** (+21 new schema tests) |
| Integration tests (`tests/`, against a running server, 38 + 1 tests) | pass | pass |
| All vitest (unit + integration) | 177 passed | **198 passed** |
| `npm run research:validate` | 8 charts, 0 errors, 0 warnings | 8 charts, 0 errors, 0 warnings |
| `npm run build` | pass | pass (Turbopack) |
| E2E journey (`scripts/e2e-journey.mjs`) | 15 / 15 | **15 / 15** |
| `npm audit --omit=dev` | 6 vulnerabilities (1 critical, 5 high) | **0 vulnerabilities** (exit code 0) |
| `npm run audit:deps` (high and above) | fails | exit code 0 |
| Server log during tests | n/a | 0 error/warning lines |

Additional verification beyond the required list:

- **Schema characterization tests** (`src/lib/__tests__/schemas.test.ts`, 21 tests). The same file passes on the original Zod 3 code and on Zod 4. Reverting `partialRecord` to `record` makes one test fail, so the tests do detect the most dangerous silent change.
- **Proxy behaviour checked with `curl` on the production build:** page CSP carries a per-request nonce and the same nonce appears on the rendered `<script>` tags; CSRF cookie issued; unauthenticated `/dashboard` → 307 to `/login?next=…`; API POST without Origin/Referer → 403; cross-origin POST → 403; `OPTIONS` → 204 with no `Access-Control-*`; API responses keep `cache-control: no-store`, `default-src 'none'` CSP and the HSTS/nosniff/frame headers.
- **Page smoke test as an administrator:** 23 server-rendered page requests (dashboard, profile, recommend, compare, history, settings, brands, brand detail, all admin pages including `?q=` / `?status=` search params and the dynamic `/admin/charts/[chartId]`) returned 200; unauthenticated `/admin` → 307. Parameterised API routes (`/api/brands/[slug]`, `/products`, `/api/admin/size-charts/[id]/csv`) returned 200.
- Prisma schema and all four migration folders are **byte-identical** to V6 (`git diff 0c8c7fa -- prisma` is empty).

## 7. Remaining vulnerabilities and follow-ups

**Production dependencies: none** (`npm audit --omit=dev` reports 0).

`npm audit` (including dev dependencies) still reports **6 vulnerabilities (3 moderate, 1 high, 2 critical)**, all in the test toolchain `vitest@2.1.9` and its dependencies (`@vitest/mocker`, `vite`/`esbuild` dev-server exposure, `tinypool` prototype-pollution RCE gadget). They are not part of the production bundle and were not in the original six, because the CI audit uses `--omit=dev`. Fix is `vitest@5.1.0` (three majors), which is a separate test-runner migration and was deliberately not bundled into this PR. Exposure is limited to running tests on a developer machine or CI with trusted code.

Other follow-ups, none a vulnerability:

1. **React 18 deprecation:** Next 16 warns that React 18 support will be removed in Next 17. Plan a React 19 upgrade as its own change (`framer-motion@11`, `lucide-react@0.462` peers need checking).
2. **Prisma 7** migration (section 5) and removal of the `deepmerge-ts` override.
3. **CI hardening (not changed here, as requested):** `.github/workflows/ci.yml` runs the audit with `continue-on-error: true`. Now that production audit passes, consider making it blocking so a regression fails the PR.
4. `vitest` upgrade as described above.

## 8. What could not be done in the authoring environment

Please let GitHub Actions confirm these on the PR:

- The sandbox could not reach `binaries.prisma.sh`, so Prisma's engine download was bypassed with environment variables. The app uses `engineType = "client"` with `@prisma/adapter-pg`, so no query-engine binary is needed at runtime and all database tests ran against real PostgreSQL 16.
- Migrations were applied to the test database by running each `migration.sql` with `psql` (identical SQL), not with `prisma migrate deploy`. The CI step that runs `prisma migrate deploy` and the non-blocking `prisma migrate diff` drift report were therefore **not** exercised here and will run for the first time in CI.
- Nothing was pushed (no GitHub credentials in the sandbox). The branch exists locally as four commits plus a final one; see the hand-off notes for how to push it. `main` and the existing pull request were not touched.
- Vercel/production deployment was not exercised. `vercel.json` needs no change; make sure the project's Node.js version is 20.9 or newer (22 is already used in CI).

## 9. Rollback

Each step is an independent commit. To go back only from the `proxy.ts` rename, revert `935dee5`. To abandon Next 16 but keep Zod 4, revert `935dee5` and `561ab52` (Next 15.5.29 is not patched, so this is not a security-neutral state).
