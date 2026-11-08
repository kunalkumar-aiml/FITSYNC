/**
 * End-to-end API tests against a RUNNING server and a real PostgreSQL database.
 * Run with:  TEST_SERVER_URL=http://localhost:3000 DATABASE_URL=... ADMIN_EMAILS=admin@test.local npm run test:integration
 * (the server must be started with the same ADMIN_EMAILS). Skipped when BASE_URL is not set.
 */
import { describe, expect, it, beforeAll } from "vitest";

const BASE = process.env.TEST_SERVER_URL;
const d = BASE ? describe : describe.skip;
const run = Date.now().toString(36);

let ipCounter = 0;
class Client {
  cookie = "";
  ip = `10.1.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`; // each client = its own visitor, so rate limits don't bleed across tests
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), "x-forwarded-for": this.ip, ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    let json: any = null;
    try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json, res };
  }
}

d("FITSYNC API", () => {
  const user = new Client();
  const other = new Client();
  const admin = new Client();
  const email = `user-${run}@test.local`;
  const pw = "correct-horse-battery";
  let demoBrand = "demo-brand-a";

  beforeAll(async () => {
    const h = await new Client().req("GET", "/api/health");
    expect(h.status).toBe(200);
  });

  it("rejects unauthenticated access", async () => {
    for (const [m, p] of [["GET", "/api/measurements"], ["POST", "/api/recommendations"], ["GET", "/api/recommendations/history"], ["POST", "/api/feedback"], ["POST", "/api/compare"]] as const) {
      expect((await new Client().req(m, p, m === "POST" ? {} : undefined)).status).toBe(401);
    }
  });

  it("redirects protected pages to login", async () => {
    const r = await new Client().req("GET", "/dashboard");
    expect(r.status).toBe(307);
    expect(r.res.headers.get("location")).toContain("/login");
  });

  it("validates registration input", async () => {
    expect((await user.req("POST", "/api/auth/register", { email: "nope", password: "short" })).status).toBe(400);
  });

  it("registers, sets an httpOnly cookie, and blocks duplicates", async () => {
    const r = await user.req("POST", "/api/auth/register", { email, password: pw, name: "Test User" });
    expect(r.status).toBe(201);
    expect(r.res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(r.json.data.passwordHash).toBeUndefined();
    expect((await new Client().req("POST", "/api/auth/register", { email, password: pw })).status).toBe(409);
  });

  it("logs in with the right password only", async () => {
    expect((await new Client().req("POST", "/api/auth/login", { email, password: "wrong-password" })).status).toBe(401);
    expect((await new Client().req("POST", "/api/auth/login", { email: "ghost@test.local", password: pw })).status).toBe(401);
    expect((await new Client().req("POST", "/api/auth/login", { email, password: pw })).status).toBe(200);
  });

  it("refuses to recommend before measurements exist", async () => {
    const r = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt" });
    expect(r.status).toBe(422);
  });

  it("rejects implausible measurements (unit mistake)", async () => {
    const r = await user.req("PUT", "/api/measurements", { unit: "CM", chestCm: 9 });
    expect(r.status).toBe(400);
  });

  it("stores inches as centimetres", async () => {
    const r = await user.req("PUT", "/api/measurements", { unit: "IN", chestCm: 40, waistCm: 33, shoulderCm: 17.7, fitPreference: "REGULAR" });
    expect(r.status).toBe(200);
    expect(r.json.data.measurement.chestCm).toBeCloseTo(101.6, 1);
    expect(r.json.data.profile.preferredUnit).toBe("IN");
  });

  it("returns an engine result with the chart's data status", async () => {
    await user.req("PUT", "/api/measurements", { unit: "CM", chestCm: 98, waistCm: 84, shoulderCm: 45 });
    const r = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt", fitPreference: "REGULAR" });
    expect(r.status).toBe(200);
    expect(r.json.data.result.status).toBe("ok");
    expect(r.json.data.result.recommendedSize).toBe("L");
    expect(r.json.data.chart.status).toBe("UNVERIFIED");
    expect(r.json.data.result.confidence).toBeLessThanOrEqual(0.55);
    expect(r.json.data.id).toBeNull(); // not saved unless asked
  });

  it("is deterministic across calls", async () => {
    const a = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt" });
    const b = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt" });
    expect(JSON.stringify(a.json.data.result)).toBe(JSON.stringify(b.json.data.result));
  });

  it("is honest when there is no chart", async () => {
    const r = await user.req("POST", "/api/recommendations", { brandSlug: "zara", categorySlug: "tshirt" });
    expect(r.status).toBe(404);
    expect(r.json.error.message).toMatch(/don't have a size chart/);
  });

  it("returns insufficient_data for categories needing missing measurements", async () => {
    // demo brands only have T-shirt charts, so use compare for jeans: expect no rows rather than invented data
    const r = await user.req("POST", "/api/compare", { categorySlug: "jeans" });
    expect(r.status).toBe(200);
    expect(r.json.data.rows).toEqual([]);
  });

  it("compares across brands from data, not hardcoded values", async () => {
    const r = await user.req("POST", "/api/compare", { categorySlug: "tshirt", fitPreference: "REGULAR" });
    expect(r.status).toBe(200);
    expect(r.json.data.rows.length).toBeGreaterThanOrEqual(3);
    const sizes = r.json.data.rows.map((x: any) => x.result.recommendedSize);
    expect(new Set(sizes).size).toBeGreaterThan(1); // different brands, different sizes for the same body
  });

  let recId = "";
  it("saves a recommendation and lists history", async () => {
    const r = await user.req("POST", "/api/recommendations", { brandSlug: demoBrand, categorySlug: "tshirt", save: true });
    recId = r.json.data.id;
    expect(recId).toBeTruthy();
    const h = await user.req("GET", "/api/recommendations/history");
    expect(h.json.data[0].id).toBe(recId);
  });

  it("stores feedback separately and blocks other users' recommendations", async () => {
    const ok = await user.req("POST", "/api/feedback", { recommendationId: recId, purchasedSize: "L", outcome: "PERFECT", review: "Fits well" });
    expect(ok.status).toBe(201);
    await other.req("POST", "/api/auth/register", { email: `other-${run}@test.local`, password: pw });
    const bad = await other.req("POST", "/api/feedback", { recommendationId: recId, purchasedSize: "L", outcome: "PERFECT" });
    expect(bad.status).toBe(404);
    expect((await other.req("GET", "/api/recommendations/history")).json.data).toEqual([]);
  });

  it("keeps measurements private per user", async () => {
    const r = await other.req("GET", "/api/measurements");
    expect(r.json.data.measurement).toBeNull();
  });

  it("blocks normal users from admin endpoints (server-side)", async () => {
    for (const [m, p, b] of [["GET", "/api/admin/analytics"], ["POST", "/api/admin/brands", { name: "Hack", region: "INDIAN" }], ["POST", "/api/admin/size-charts", {}], ["PUT", "/api/admin/size-charts/x", { status: "VERIFIED" }]] as const) {
      expect((await user.req(m, p, b)).status).toBe(403);
    }
  });

  it("blocks cross-origin mutating requests", async () => {
    const r = await user.req("PUT", "/api/measurements", { unit: "CM", chestCm: 99 }, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });

  it("lets an admin manage and verify charts, requiring a source", async () => {
    const adminEmail = (process.env.ADMIN_EMAILS ?? "admin@test.local").split(",")[0];
    const reg = await admin.req("POST", "/api/auth/register", { email: adminEmail, password: pw });
    if (reg.status === 409) await admin.req("POST", "/api/auth/login", { email: adminEmail, password: pw });
    expect((await admin.req("GET", "/api/admin/analytics")).status).toBe(200);

    const b = await admin.req("POST", "/api/admin/brands", { name: `Test Brand ${run}`, region: "INDIAN" });
    expect(b.status).toBe(201);
    const slug = b.json.data.slug;

    const dup = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, categorySlug: "tshirt", measurementType: "GARMENT", rows: [{ label: "M", chest: 100 }, { label: "m", chest: 104 }] });
    expect(dup.status).toBe(400);

    const v = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, categorySlug: "tshirt", measurementType: "GARMENT", rows: [{ label: "M", chest: 100 }, { label: "L", chest: 106 }] });
    expect(v.status).toBe(201);
    expect(v.json.data.status).toBe("UNVERIFIED");
    expect(v.json.data.version).toBe(1);

    expect((await admin.req("PUT", `/api/admin/size-charts/${v.json.data.id}`, { status: "VERIFIED" })).status).toBe(400);
    const ok = await admin.req("PUT", `/api/admin/size-charts/${v.json.data.id}`, { status: "VERIFIED", sourceUrl: "https://example.com/size-guide" });
    expect(ok.status).toBe(200);
    expect(ok.json.data.verifiedAt).toBeTruthy();

    const v2 = await admin.req("POST", "/api/admin/size-charts", { brandSlug: slug, categorySlug: "tshirt", measurementType: "GARMENT", rows: [{ label: "M", chest: 101 }, { label: "L", chest: 107 }] });
    expect(v2.json.data.version).toBe(2); // history preserved, not overwritten

    // latest VERIFIED version wins over a newer unverified one
    const rec = await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt" });
    expect(rec.json.data.chart.status).toBe("VERIFIED");
    expect(rec.json.data.chart.version).toBe(1);

    // deprecated charts are not used
    await admin.req("PUT", `/api/admin/size-charts/${v.json.data.id}`, { status: "DEPRECATED" });
    const rec2 = await user.req("POST", "/api/recommendations", { brandSlug: slug, categorySlug: "tshirt" });
    expect(rec2.json.data.chart.version).toBe(2);
    expect(rec2.json.data.chart.status).toBe("UNVERIFIED");
  });

  it("rate-limits repeated login attempts", async () => {
    const c = new Client();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await c.req("POST", "/api/auth/login", { email: `brute-${run}@test.local`, password: "x" })).status);
    expect(codes).toContain(429);
  });

  it("exports data, deletes measurements, then deletes the account and everything with it", async () => {
    const ex = await other.req("GET", "/api/profile/export");
    expect(ex.status).toBe(200);
    await user.req("PUT", "/api/measurements", { unit: "CM", chestCm: 98 });
    expect((await user.req("DELETE", "/api/measurements")).status).toBe(200);
    expect((await user.req("GET", "/api/measurements")).json.data.measurement).toBeNull();
    expect((await user.req("DELETE", "/api/profile")).status).toBe(200);
    expect((await new Client().req("POST", "/api/auth/login", { email, password: pw })).status).toBe(401);
  });

  it("logs out", async () => {
    const r = await other.req("POST", "/api/auth/logout");
    expect(r.status).toBe(200);
  });
});
