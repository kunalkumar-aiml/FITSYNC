/**
 * End-to-end API tests against a RUNNING server and a real PostgreSQL database.
 *
 *   npx prisma migrate deploy && SEED_DEMO=true npm run db:seed
 *   ADMIN_BOOTSTRAP_PASSWORD=tailor-linen-meadow-42 npm run admin:bootstrap -- --email admin@test.local
 *   (start the server with TRUST_PROXY=true EMAIL_PROVIDER=outbox ALLOW_TEST_EMAIL_OUTBOX=true EMAIL_OUTBOX_DIR=/tmp/fitsync-outbox CRON_SECRET=...)
 *   TEST_SERVER_URL=http://localhost:3100 EMAIL_OUTBOX_DIR=/tmp/fitsync-outbox npx vitest run tests
 *
 * Skipped when TEST_SERVER_URL is not set.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.TEST_SERVER_URL;
const OUTBOX = process.env.EMAIL_OUTBOX_DIR ?? "/tmp/fitsync-outbox";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@test.local";
const ADMIN_PW = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "tailor-linen-meadow-42";
const d = BASE ? describe : describe.skip;
const run = Date.now().toString(36);

let ipCounter = 0;
class Client {
  jar = new Map<string, string>();
  ip = `10.1.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`; // each client = its own visitor (server runs with TRUST_PROXY=true)
  get csrf() { return this.jar.get("__Host-fitsync_csrf") ?? this.jar.get("fitsync_csrf") ?? ""; }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (!v || expired) this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  async init() { if (!this.csrf) this.store(await fetch(BASE + "/api/auth/csrf", { headers: { "x-forwarded-for": this.ip } })); return this; }
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, opts: { csrf?: boolean; origin?: boolean } = {}) {
    const mutating = !["GET", "HEAD"].includes(method);
    if (mutating && opts.csrf !== false) await this.init();
    const res = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.jar.size ? { cookie: this.cookieHeader() } : {}),
        ...(mutating && opts.origin !== false ? { origin: BASE! } : {}),
        ...(mutating && opts.csrf !== false ? { "x-csrf-token": this.csrf } : {}),
        "x-forwarded-for": this.ip, ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.store(res);
    let json: any = null;
    try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json, res };
  }
}

/** Latest email sent to `to` through the test outbox. */
function lastEmail(to: string): { subject: string; text: string } {
  if (!existsSync(OUTBOX)) throw new Error(`No outbox at ${OUTBOX}`);
  const files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  for (const f of files.reverse()) { const m = JSON.parse(readFileSync(join(OUTBOX, f), "utf8")); if (m.to === to) return m; }
  throw new Error(`No email for ${to}`);
}
const tokenFrom = (text: string) => decodeURIComponent(/token=([A-Za-z0-9_%-]+)/.exec(text)![1]);

d("FITSYNC API", () => {
  const user = new Client();
  const other = new Client();
  const admin = new Client();
  const email = `user-${run}@test.local`;
  const pw = "correct-horse-battery";
  const demoBrand = "demo-brand-a";
  const chartMeta = { categorySlug: "tshirt", measurementType: "GARMENT", fitCut: "REGULAR", originalUnit: "CM" };

  beforeAll(async () => {
    expect((await new Client().req("GET", "/api/health")).status).toBe(200);
    const r = await admin.req("POST", "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PW });
    expect(r.status, "bootstrap an admin first (npm run admin:bootstrap)").toBe(200);
  });

  // ---------------------------------------------------------------- web security
  it("rejects unauthenticated access", async () => {
    for (const [m, p] of [["GET", "/api/measurements"], ["POST", "/api/recommendations"], ["GET", "/api/recommendations/history"], ["POST", "/api/feedback"], ["POST", "/api/compare"], ["GET", "/api/auth/sessions"], ["GET", "/api/profile/export"]] as const) {
      expect((await new Client().req(m, p, m === "POST" ? {} : undefined)).status, p).toBe(401);
    }
  });

  it("redirects protected pages to login and sends security headers", async () => {
    const r = await new Client().req("GET", "/dashboard");
    expect(r.status).toBe(307);
    expect(r.res.headers.get("location")).toContain("/login");
    const home = await fetch(BASE + "/");
    const csp = home.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[\w-]+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    const html = await home.text();
    const nonce = /'nonce-([\w-]+)'/.exec(csp)![1];
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(s, s).toContain(`nonce="${nonce}"`);
    expect(home.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("CSRF: mutations need same origin AND the double-submit token", async () => {
    const c = await new Client().init();
    const body = { email: "x@test.local", password: "whatever-whatever" };
    expect((await c.req("POST", "/api/auth/login", body, {}, { csrf: false })).status).toBe(403); // no token
    expect((await c.req("POST", "/api/auth/login", body, { "x-csrf-token": "wrong-token-wrong-token" })).status).toBe(403);
    expect((await c.req("POST", "/api/auth/login", body, { origin: "https://evil.example" })).status).toBe(403);
    expect((await c.req("POST", "/api/auth/login", body, {}, { origin: false })).status).toBe(403); // neither Origin nor Referer
    expect((await c.req("POST", "/api/auth/login", body, { referer: `${BASE}/login` }, { origin: false })).status).toBe(401); // Referer fallback accepted
    const pre = await fetch(BASE + "/api/auth/login", { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
    expect(pre.headers.get("access-control-allow-origin")).toBeNull(); // no CORS
  });

  // ---------------------------------------------------------------- registration & verification
  it("validates registration input: email, length, common passwords", async () => {
    const c = new Client();
    expect((await c.req("POST", "/api/auth/register", { email: "nope", password: "a-long-enough-pass" })).status).toBe(400);
    const short = await c.req("POST", "/api/auth/register", { email: `s-${run}@test.local`, password: "short" });
    expect(short.status).toBe(400);
    expect(short.json.error.details.password[0]).toMatch(/10 characters/);
    expect((await c.req("POST", "/api/auth/register", { email: `p-${run}@test.local`, password: "password123" })).status).toBe(400);
  });

  it("registers a USER (never an admin), sets an HttpOnly session, and blocks duplicates", async () => {
    const r = await user.req("POST", "/api/auth/register", { email: `  ${email.toUpperCase()} `, password: pw, name: "Test User" });
    expect(r.status).toBe(201);
    expect(r.json.data.user.email).toBe(email); // normalised
    expect(r.json.data.user.role).toBe("USER");
    expect(r.json.data.user.passwordHash).toBeUndefined();
    expect(r.json.data.verification.delivery).toBe("outbox");
    expect(r.res.headers.getSetCookie().join(";")).toMatch(/fitsync_sid=.*HttpOnly/i);
    expect((await new Client().req("POST", "/api/auth/register", { email, password: pw })).status).toBe(409);
    expect((await user.req("GET", "/api/admin/users")).status).toBe(403);
  });

  it("an admin-looking email gets no privileges (ADMIN_EMAILS promotion is gone)", async () => {
    const c = new Client();
    const r = await c.req("POST", "/api/auth/register", { email: `admin-${run}@test.local`, password: pw });
    expect(r.json.data.user.role).toBe("USER");
    expect((await c.req("GET", "/api/admin/analytics")).status).toBe(403);
  });

  it("verifies email with a single-use token", async () => {
    const token = tokenFrom(lastEmail(email).text);
    const ok = await new Client().req("POST", "/api/auth/verify-email", { token });
    expect(ok.status).toBe(200);
    expect((await new Client().req("POST", "/api/auth/verify-email", { token })).status).toBe(400); // used
    expect((await new Client().req("POST", "/api/auth/verify-email", { token: "x".repeat(43) })).status).toBe(400);
    expect((await user.req("POST", "/api/auth/verify-email/resend")).status).toBe(400); // already verified
  });

  it("logs in with the right password only, with a generic error", async () => {
    const wrong = await new Client().req("POST", "/api/auth/login", { email, password: "wrong-password" });
    const ghost = await new Client().req("POST", "/api/auth/login", { email: "ghost@test.local", password: pw });
    expect(wrong.status).toBe(401); expect(ghost.status).toBe(401);
    expect(wrong.json.error.message).toBe(ghost.json.error.message);
    expect((await new Client().req("POST", "/api/auth/login", { email, password: pw })).status).toBe(200);
  });

  // ---------------------------------------------------------------- sessions
  it("sessions are server-side: logout revokes, and a stolen old cookie stops working", async () => {
    const a = new Client();
    expect((await a.req("POST", "/api/auth/login", { email, password: pw })).status).toBe(200);
    const stolen = new Client(); stolen.jar = new Map(a.jar);
    expect((await stolen.req("GET", "/api/auth/sessions")).status).toBe(200);
    expect((await a.req("POST", "/api/auth/logout")).status).toBe(200);
    expect((await stolen.req("GET", "/api/auth/sessions")).status).toBe(401);
  });

  it("lists only your own sessions and refuses to revoke someone else's (IDOR)", async () => {
    const mine = await user.req("GET", "/api/auth/sessions");
    expect(mine.status).toBe(200);
    expect(mine.json.data.some((s: any) => s.current)).toBe(true);
    await other.req("POST", "/api/auth/register", { email: `other-${run}@test.local`, password: pw });
    const theirs = (await other.req("GET", "/api/auth/sessions")).json.data[0].id;
    expect((await user.req("DELETE", `/api/auth/sessions/${theirs}`)).status).toBe(404);
    expect((await other.req("GET", "/api/auth/sessions")).status).toBe(200); // still signed in
  });

  it("logout-all signs out every device", async () => {
    const a = new Client(), b = new Client();
    const e2 = `multi-${run}@test.local`;
    await a.req("POST", "/api/auth/register", { email: e2, password: pw });
    await b.req("POST", "/api/auth/login", { email: e2, password: pw });
    expect((await a.req("POST", "/api/auth/logout-all")).status).toBe(200);
    expect((await a.req("GET", "/api/auth/sessions")).status).toBe(401);
    expect((await b.req("GET", "/api/auth/sessions")).status).toBe(401);
  });

  // ---------------------------------------------------------------- password reset
  it("password reset: same answer for unknown emails, single-use token, all sessions revoked", async () => {
    const e3 = `reset-${run}@test.local`;
    const a = new Client();
    await a.req("POST", "/api/auth/register", { email: e3, password: pw });
    const known = await new Client().req("POST", "/api/auth/password/forgot", { email: e3 });
    const unknown = await new Client().req("POST", "/api/auth/password/forgot", { email: `nobody-${run}@test.local` });
    expect(known.status).toBe(200); expect(unknown.status).toBe(200);
    expect(known.json.data.message).toBe(unknown.json.data.message);
    const token = tokenFrom(lastEmail(e3).text);
    const weak = await new Client().req("POST", "/api/auth/password/reset", { token, password: "short" });
    expect(weak.status).toBe(400);
    const newPw = "another-lovely-passphrase";
    expect((await new Client().req("POST", "/api/auth/password/reset", { token, password: newPw })).status).toBe(200);
    expect((await new Client().req("POST", "/api/auth/password/reset", { token, password: newPw })).status).toBe(400); // single use
    expect((await a.req("GET", "/api/auth/sessions")).status).toBe(401); // revoked
    expect((await new Client().req("POST", "/api/auth/login", { email: e3, password: pw })).status).toBe(401);
    expect((await new Client().req("POST", "/api/auth/login", { email: e3, password: newPw })).status).toBe(200);
  });

  it("password change needs the current password and keeps this device signed in", async () => {
    const c = new Client(); const e4 = `change-${run}@test.local`;
    await c.req("POST", "/api/auth/register", { email: e4, password: pw });
    expect((await c.req("POST", "/api/auth/password/change", { currentPassword: "nope", newPassword: "a-brand-new-passphrase" })).status).toBe(400);
    expect((await c.req("POST", "/api/auth/password/change", { currentPassword: pw, newPassword: "a-brand-new-passphrase" })).status).toBe(200);
    expect((await c.req("GET", "/api/auth/sessions")).status).toBe(200);
  });

  // ---------------------------------------------------------------- measurements & recommendations
  it("refuses to recommend before measurements exist", async () => {
    expect((await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt" })).status).toBe(422);
  });

  it("rejects implausible measurements (unit mistake)", async () => {
    expect((await user.req("PUT", "/api/measurements", { unit: "CM", chestCm: 9 })).status).toBe(400);
  });

  it("stores inches as centimetres", async () => {
    const r = await user.req("PUT", "/api/measurements", { unit: "IN", chestCm: 40, waistCm: 33, shoulderCm: 17.7, fitPreference: "REGULAR" });
    expect(r.status).toBe(200);
    expect(r.json.data.measurement.chestCm).toBeCloseTo(101.6, 1);
    expect(r.json.data.profile.preferredUnit).toBe("IN");
  });

  it("returns an engine result with the chart's data status", async () => {
    await user.req("PUT", "/api/measurements", { unit: "CM", chestCm: 98, waistCm: 84, shoulderCm: 45, fitCategory: "MEN" });
    const r = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt", fitPreference: "REGULAR" });
    expect(r.status).toBe(200);
    expect(r.json.data.result.status).toBe("ok");
    expect(r.json.data.result.recommendedSize).toBe("L");
    expect(r.json.data.chart.status).toBe("UNVERIFIED");
    expect(r.json.data.result.fitMatchScore).toBeLessThanOrEqual(0.55);
    expect(r.json.data.result.ranking[0].dimensions[0].semantic).toBe("GARMENT");
    expect(r.json.data.id).toBeNull();
  });

  it("is deterministic across calls", async () => {
    const a = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt" });
    const b = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt" });
    expect(JSON.stringify(a.json.data.result)).toBe(JSON.stringify(b.json.data.result));
  });

  it("is honest when there is no chart: DATA_UNAVAILABLE with the reason, never a guess", async () => {
    const r = await user.req("POST", "/api/recommendations", { brandSlug: "zara", categorySlug: "tshirt" });
    expect(r.status).toBe(404);
    expect(r.json.error.details.code).toBe("DATA_UNAVAILABLE");
  });

  it("requires a sizing type and never mixes men's and women's charts", async () => {
    const c = new Client();
    await c.req("POST", "/api/auth/register", { email: `gender-${run}@test.local`, password: pw });
    await c.req("PUT", "/api/measurements", { unit: "CM", chestCm: 98, waistCm: 84, shoulderCm: 45 });
    const r = await c.req("POST", "/api/recommendations", { brandSlug: "nike", categorySlug: "tshirt" });
    expect(r.status).toBe(422);
    expect(r.json.error.details.code).toBe("GENDER_REQUIRED");
    const men = await user.req("POST", "/api/recommendations", { brandSlug: "nike", categorySlug: "tshirt", gender: "MEN" });
    const women = await user.req("POST", "/api/recommendations", { brandSlug: "nike", categorySlug: "tshirt", gender: "WOMEN" });
    expect(men.json.data.gender).toBe("MEN"); expect(women.json.data.gender).toBe("WOMEN");
    expect(men.json.data.result.recommendedSize).not.toBe(women.json.data.result.recommendedSize);
  });

  it("serves real sourced Nike data: official source recorded, body measurements, unverified", async () => {
    const r = await user.req("POST", "/api/recommendations", { brandSlug: "nike", categorySlug: "tshirt", gender: "MEN" });
    expect(r.json.data.chart.sourceType).toBe("OFFICIAL_SITE");
    expect(r.json.data.chart.sourceUrl).toMatch(/^https:\/\/www\.nike\.com\//);
    expect(r.json.data.chart.measurementType).toBe("BODY");
    expect(r.json.data.result.status).toBe("ok");
    expect(r.json.data.result.achievedFit).toBeNull(); // body chart: real fit depends on the unstated cut
    expect(r.json.data.options.length).toBeGreaterThan(1);
  });

  it("compare lists brands with no data separately instead of inventing sizes", async () => {
    const r = await user.req("POST", "/api/compare", { categorySlug: "jeans", gender: "MEN" });
    expect(r.json.data.rows).toEqual([]);
    expect(r.json.data.unavailable.some((u: any) => u.brand.slug === "zara")).toBe(true);
    const t = await user.req("POST", "/api/compare", { categorySlug: "tshirt", fitPreference: "REGULAR", gender: "MEN" });
    expect(t.json.data.rows.some((x: any) => x.brand.slug === "nike")).toBe(true);
    expect(new Set(t.json.data.rows.map((x: any) => x.result.recommendedSize)).size).toBeGreaterThan(1);
  });

  let recId = "";
  it("saves a recommendation and lists only your own history", async () => {
    const r = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt", save: true });
    recId = r.json.data.id;
    expect(recId).toBeTruthy();
    expect((await user.req("GET", "/api/recommendations/history")).json.data[0].id).toBe(recId);
    expect((await other.req("GET", "/api/recommendations/history")).json.data).toEqual([]);
  });

  it("feedback: stored separately, one report per recommendation, other users blocked (IDOR)", async () => {
    expect((await user.req("POST", "/api/feedback", { recommendationId: recId, purchasedSize: "L", outcome: "TOO_TIGHT" })).status).toBe(201);
    const again = await user.req("POST", "/api/feedback", { recommendationId: recId, purchasedSize: "L", outcome: "PERFECT", review: "Fits well" });
    expect(again.status).toBe(200); // corrected, not duplicated
    expect((await user.req("GET", "/api/recommendations/history")).json.data[0].feedback.outcome).toBe("PERFECT");
    expect((await other.req("POST", "/api/feedback", { recommendationId: recId, purchasedSize: "L", outcome: "PERFECT" })).status).toBe(404);
  });

  it("keeps measurements private per user", async () => {
    expect((await other.req("GET", "/api/measurements")).json.data.measurement).toBeNull();
  });

  // ---------------------------------------------------------------- authorization
  it("every admin endpoint refuses normal users (403) and anonymous visitors (401)", async () => {
    const routes: [string, string, unknown?][] = [
      ["GET", "/api/admin/analytics"], ["GET", "/api/admin/users"], ["PATCH", "/api/admin/users/x", { role: "ADMIN", confirm: true, reason: "test" }], ["GET", "/api/admin/audit"],
      ["POST", "/api/admin/brands", { name: "Hack", region: "INDIAN" }], ["PATCH", "/api/admin/brands/nike", { active: false }],
      ["POST", "/api/admin/size-charts", {}], ["PUT", "/api/admin/size-charts/x", { action: "APPROVE" }], ["POST", "/api/admin/size-charts/x/edit", {}], ["GET", "/api/admin/size-charts/x/csv"],
      ["POST", "/api/admin/size-charts/import", {}], ["POST", "/api/admin/products", {}], ["POST", "/api/admin/marketplaces", {}],
      ["GET", "/api/admin/research"], ["POST", "/api/admin/research", {}], ["POST", "/api/admin/research/x/retry"], ["POST", "/api/admin/research/discover", {}], ["POST", "/api/admin/coverage-notes", {}],
    ];
    for (const [m, p, b] of routes) {
      expect((await user.req(m, p, b)).status, `${m} ${p} as user`).toBe(403);
      expect((await new Client().req(m, p, b)).status, `${m} ${p} anonymous`).toBe(401);
    }
  });

  it("admin user management: verified-only promotion, no self-change, audited", async () => {
    const list = await admin.req("GET", `/api/admin/users?q=${encodeURIComponent(`other-${run}`)}`);
    expect(list.status).toBe(200);
    const target = list.json.data.users[0];
    expect(target.email).toBe(`other-${run}@test.local`);
    expect(JSON.stringify(list.json.data)).not.toMatch(/chestCm|passwordHash/);
    const unverified = await admin.req("PATCH", `/api/admin/users/${target.id}`, { role: "ADMIN", confirm: true, reason: "testing promotion" });
    expect(unverified.status).toBe(400);
    expect(unverified.json.error.message).toMatch(/confirmed email/);
    const meList = await admin.req("GET", `/api/admin/users?q=${encodeURIComponent(ADMIN_EMAIL)}`);
    const me = meList.json.data.users[0];
    expect((await admin.req("PATCH", `/api/admin/users/${me.id}`, { role: "USER", confirm: true, reason: "self" })).status).toBe(400);
    expect((await admin.req("PATCH", `/api/admin/users/${target.id}`, { disabled: true, reason: "missing confirm" })).status).toBe(400);
    // disabling signs the account out and blocks login
    expect((await admin.req("PATCH", `/api/admin/users/${target.id}`, { disabled: true, confirm: true, reason: "abuse test" })).status).toBe(200);
    expect((await other.req("GET", "/api/auth/sessions")).status).toBe(401);
    expect((await new Client().req("POST", "/api/auth/login", { email: `other-${run}@test.local`, password: pw })).status).toBe(403);
    expect((await admin.req("PATCH", `/api/admin/users/${target.id}`, { disabled: false, confirm: true, reason: "restore" })).status).toBe(200);
    expect((await other.req("POST", "/api/auth/login", { email: `other-${run}@test.local`, password: pw })).status).toBe(200);
    const audit = await admin.req("GET", "/api/admin/audit");
    expect(audit.json.data.admin.some((a: any) => a.action === "user.status.change" && a.targetId === target.id)).toBe(true);
    // a verified user can be promoted
    const v = await admin.req("GET", `/api/admin/users?q=${encodeURIComponent(email)}`);
    const verifiedUser = v.json.data.users[0];
    expect((await admin.req("PATCH", `/api/admin/users/${verifiedUser.id}`, { role: "ADMIN", confirm: true, reason: "promotion test" })).status).toBe(200);
    expect((await user.req("GET", "/api/admin/users")).status).toBe(200); // role read from DB on every request
    expect((await admin.req("PATCH", `/api/admin/users/${verifiedUser.id}`, { role: "USER", confirm: true, reason: "demotion test" })).status).toBe(200);
    expect((await user.req("GET", "/api/admin/users")).status).toBe(401); // demotion signed them out
    expect((await user.req("POST", "/api/auth/login", { email, password: pw })).status).toBe(200);
    expect((await user.req("GET", "/api/admin/users")).status).toBe(403);
  });

  // ---------------------------------------------------------------- data management
  it("admin manages and verifies charts; unit, meaning and cut are never defaulted", async () => {
    const b = await admin.req("POST", "/api/admin/brands", { name: `Test Brand ${run}`, region: "INDIAN" });
    expect(b.status).toBe(201);
    const slug = b.json.data.slug;
    const rows = [{ label: "M", chest: 100 }, { label: "L", chest: 106 }];
    expect((await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, categorySlug: "tshirt", measurementType: "GARMENT", fitCut: "REGULAR", rows, sourceNote: "test" })).status).toBe(400); // no unit
    expect((await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, categorySlug: "tshirt", measurementType: "GARMENT", originalUnit: "CM", rows, sourceNote: "test" })).status).toBe(400); // no cut
    expect((await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, ...chartMeta, rows: [{ label: "M", chest: 100 }, { label: "m", chest: 104 }], sourceNote: "test" })).status).toBe(400);
    expect((await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, ...chartMeta, rows })).status).toBe(400); // no source

    const v = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, ...chartMeta, rows, sourceNote: "test chart" });
    expect(v.status).toBe(201);
    expect(v.json.data.status).toBe("UNVERIFIED");
    const dup = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, ...chartMeta, rows, sourceNote: "same again" });
    expect(dup.json.data.duplicate).toBe(true);
    expect(dup.json.data.id).toBe(v.json.data.id);

    expect((await admin.req("PUT", `/api/admin/size-charts/${v.json.data.id}`, { action: "REJECT" })).status).toBe(400); // reason required
    const ok = await admin.req("PUT", `/api/admin/size-charts/${v.json.data.id}`, { action: "APPROVE", sourceUrl: "https://example.com/size-guide" });
    expect(ok.status).toBe(200);
    expect(ok.json.data.status).toBe("VERIFIED");

    const v2 = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, ...chartMeta, rows: [{ label: "M", chest: 101 }, { label: "L", chest: 107 }], sourceNote: "v2" });
    expect(v2.json.data.version).toBe(2);
    const rec = await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt", gender: "UNISEX" });
    expect(rec.json.data.chart.version).toBe(1); // verified wins over newer unverified
    await admin.req("PUT", `/api/admin/size-charts/${v.json.data.id}`, { action: "DEPRECATE", note: "replaced" });
    const rec2 = await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt", gender: "UNISEX" });
    expect(rec2.json.data.chart.version).toBe(2);
    await admin.req("PUT", `/api/admin/size-charts/${v2.json.data.id}`, { action: "FLAG", note: "needs a second look" });
    expect((await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt", gender: "UNISEX" })).status).toBe(404); // flagged: not used

    // an UNKNOWN-meaning chart gives no size until resolved; approval is refused meanwhile
    const unk = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, ...chartMeta, categorySlug: "polo", measurementType: "UNKNOWN", rows, sourceNote: "listing" });
    const r3 = await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "polo", gender: "UNISEX" });
    expect(r3.json.data.result.status).toBe("insufficient_data");
    expect((await admin.req("PUT", `/api/admin/size-charts/${unk.json.data.id}`, { action: "APPROVE" })).status).toBe(400);
    // a flat width is resolved and explicitly converted (x2) into a new unverified version
    const res = await admin.req("POST", `/api/admin/size-charts/${unk.json.data.id}/edit`, { resolveSemantics: { chest: "GARMENT_WIDTH_FLAT" }, convertFlatToCircumference: true, note: "Listing says pit-to-pit" });
    expect(res.status).toBe(201);
    expect(res.json.data.rows[0].chest).toBe(200);
    expect(res.json.data.measurementSemantics.chest).toBe("GARMENT_CIRCUMFERENCE");
    expect(res.json.data.status).toBe("UNVERIFIED");
  });

  it("CSV import: validates first, saves nothing on errors, unit required, saves unverified", async () => {
    const b = await admin.req("POST", "/api/admin/brands", { name: `Csv Brand ${run}`, region: "INDIAN" });
    const slug = b.json.data.slug;
    const meta = { brandSlug: slug, categorySlug: "tshirt", gender: "WOMEN", region: "IN", productLine: "Basics", measurementType: "BODY", fitCut: "UNKNOWN", originalUnit: "IN", sourceType: "OFFICIAL_SITE", sourceUrl: "https://example.com/size-guide" };
    const bad = await admin.req("POST", "/api/admin/size-charts/import", { ...meta, csv: "label,chest\nS,<31\nM,abc" });
    expect(bad.status).toBe(400);
    expect(bad.json.error.details.errors.length).toBeGreaterThanOrEqual(2);
    const csv = "label,chest,waist\nS,32.5-35.5,26-29\nM,35.5-38,29-31.5\nL,38-41,31.5-34.5";
    const { originalUnit: _u, ...noUnit } = meta;
    expect((await admin.req("POST", "/api/admin/size-charts/import", { ...noUnit, csv })).status).toBe(400);
    const dry = await admin.req("POST", "/api/admin/size-charts/import", { ...meta, csv, dryRun: true });
    expect(dry.json.data.rows[0].chest).toBeCloseTo(82.6, 1);
    expect((await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt", gender: "WOMEN" })).status).toBe(404);
    const saved = await admin.req("POST", "/api/admin/size-charts/import", { ...meta, csv });
    expect(saved.status).toBe(201);
    expect(saved.json.data.version.status).toBe("UNVERIFIED");
    expect((await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt", gender: "WOMEN" })).status).toBe(200);
    expect((await admin.req("POST", "/api/admin/size-charts/import", { ...meta, sourceUrl: undefined, csv })).status).toBe(400);
    expect((await admin.req("POST", "/api/admin/size-charts/import", { ...meta, sourceUrl: "javascript:alert(1)", csv })).status).toBe(400);
  });

  it("product-level data keeps the real brand; ambiguous product charts give no size", async () => {
    expect((await user.req("POST", "/api/recommendations", { brandSlug: "bewakoof", categorySlug: "tshirt", gender: "MEN" })).status).toBe(404);
    const list = await user.req("GET", "/api/brands/bewakoof/products?category=tshirt");
    expect(list.json.data.length).toBe(2);
    for (const p of list.json.data) { expect(p.brand).toBe("Bewakoof"); expect(p.listedOn[0].marketplace).toBe("Nykaa Man"); }
    expect((await user.req("GET", "/api/brands/flipkart")).status).toBe(404);
    const unknownCut = list.json.data.find((p: any) => /Gyomi/.test(p.name));
    expect(unknownCut.fitCut).toBe("UNKNOWN"); // never assumed REGULAR
    const prod = list.json.data.find((p: any) => /Purple Beast/.test(p.name));
    const blocked = await user.req("POST", "/api/recommendations", { brandSlug: "bewakoof", categorySlug: "tshirt", gender: "MEN", productId: prod.id });
    expect(blocked.json.data.result.status).toBe("insufficient_data");
    expect(blocked.json.data.result.explanation).toMatch(/ambiguous/);
    expect(blocked.json.data.chart.measurementType).toBe("UNKNOWN");
  });

  it("research API: unsafe or non-allowlisted URLs are refused before anything is fetched", async () => {
    const mk = (url: string) => ({ targets: [{ brand: "nike", category: "tshirt", gender: "MEN", region: "GLOBAL", url }] });
    for (const bad of ["http://169.254.169.254/latest/meta-data", "https://127.0.0.1/admin", "https://localhost:3000/api/health", "https://evil.example.com/size", "file:///etc/passwd", "https://www.nike.com@evil.com/x"]) {
      expect((await admin.req("POST", "/api/admin/research", mk(bad))).status, bad).toBe(400);
    }
    const six = { targets: Array.from({ length: 6 }, (_, i) => ({ brand: "nike", category: "tshirt", gender: "MEN", region: "GLOBAL", url: `https://www.nike.com/size-fit/t${i}` })) };
    expect((await admin.req("POST", "/api/admin/research", six)).status).toBe(400);
  });

  it("research API: a job records each source; failures are never stored as data", async () => {
    const r = await admin.req("POST", "/api/admin/research", { targets: [{ brand: "nike", category: "tshirt", gender: "MEN", region: "GLOBAL", url: "https://www.nike.com/size-fit/fitsync-integration-test-page" }] });
    expect(r.status).toBe(201);
    expect(r.json.data.sources.length).toBe(1);
    if (!["SUCCESS", "PARTIAL_SUCCESS", "NEEDS_HUMAN_VERIFICATION"].includes(r.json.data.sources[0].status)) expect(r.json.data.sources[0].chartVersionId).toBeNull();
  });

  it("discovery says plainly when no search API is configured", async () => {
    const r = await admin.req("POST", "/api/admin/research/discover", { brand: "nike", category: "tshirt", gender: "MEN" });
    expect(r.status).toBe(200);
    if (!r.json.data.configured) { expect(r.json.data.candidates).toEqual([]); expect(r.json.data.errors[0]).toMatch(/not configured/); }
  });

  it("marketplaces and products: a product keeps its real brand; unstated cut is UNKNOWN", async () => {
    const mk = await admin.req("POST", "/api/admin/marketplaces", { name: `Test Market ${run}`, domain: `market-${run}.example.com` });
    expect(mk.status).toBe(201);
    expect((await admin.req("POST", "/api/admin/products", { brandSlug: "nike", name: "Nike Test Tee", categorySlug: "tshirt", gender: "MEN", marketplaceSlug: mk.json.data.slug })).status).toBe(400);
    const p = await admin.req("POST", "/api/admin/products", { brandSlug: "nike", name: `Nike Test Tee ${run}`, categorySlug: "tshirt", gender: "MEN", fitCut: "SLIM", marketplaceSlug: mk.json.data.slug, listingUrl: `https://market-${run}.example.com/p/1` });
    expect(p.status).toBe(201);
    expect(p.json.data.fitCut).toBe("UNKNOWN"); // SLIM was not marked as stated on the listing
    const note = await admin.req("POST", "/api/admin/coverage-notes", { brandSlug: "nike", productId: p.json.data.id, note: "Listing has no size table at all." });
    expect(note.status).toBe(201);
    expect(note.json.data.productId).toBe(p.json.data.id); // product-level missing data, distinct from brand-level
  });

  // ---------------------------------------------------------------- abuse & operations
  it("rate-limits repeated login attempts", async () => {
    const c = new Client();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await c.req("POST", "/api/auth/login", { email: `brute-${run}@test.local`, password: "x" })).status);
    expect(codes).toContain(429);
  });

  it("cron cleanup requires its bearer secret", async () => {
    expect((await fetch(BASE + "/api/cron/cleanup")).status).toBe(401);
    expect((await fetch(BASE + "/api/cron/cleanup", { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    if (process.env.CRON_SECRET) expect((await fetch(BASE + "/api/cron/cleanup", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).status).toBe(200);
  });

  it("exports data without secrets, deletes measurements, then deletes the account (password required)", async () => {
    const ex = await user.req("GET", "/api/profile/export");
    expect(ex.status).toBe(200);
    expect(JSON.stringify(ex.json)).not.toMatch(/passwordHash|tokenHash/);
    expect(ex.json.email).toBe(email);
    expect((await user.req("DELETE", "/api/measurements")).status).toBe(200);
    expect((await user.req("GET", "/api/measurements")).json.data.measurement).toBeNull();
    expect((await user.req("DELETE", "/api/profile", { password: "wrong-password" })).status).toBe(400);
    expect((await user.req("DELETE", "/api/profile", { password: pw })).status).toBe(200);
    expect((await new Client().req("POST", "/api/auth/login", { email, password: pw })).status).toBe(401);
  });
});
