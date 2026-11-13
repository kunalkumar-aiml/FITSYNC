#!/usr/bin/env node
/**
 * End-to-end user journey against a RUNNING FITSYNC server (API level, real database).
 *
 *   node scripts/e2e-journey.mjs http://localhost:3000
 *
 * Creates ONE dedicated test account (e2e-<timestamp>@test.local), walks the 15 steps below and deletes that
 * account at the end. It never touches any other account. Exit code 1 if any step fails.
 * The server must run with TRUST_PROXY unset or true; the script sends its own x-forwarded-for.
 */
const BASE = (process.argv[2] ?? process.env.TEST_SERVER_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const run = Date.now().toString(36);
const EMAIL = `e2e-${run}@test.local`;
const PW = "linen-tailor-meadow-e2e-77";
const ip = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;

class Client {
  jar = new Map();
  get csrf() { return this.jar.get("__Host-fitsync_csrf") ?? this.jar.get("fitsync_csrf") ?? ""; }
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      if (!v || attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a))) this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  async req(method, path, body) {
    if (method !== "GET" && !this.csrf) this.store(await fetch(BASE + "/api/auth/csrf", { headers: { "x-forwarded-for": ip } }));
    const res = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.jar.size ? { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        ...(method !== "GET" ? { origin: BASE, "x-csrf-token": this.csrf } : {}),
        "x-forwarded-for": ip,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.store(res);
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json };
  }
}

const results = [];
async function step(n, name, fn) {
  try {
    const detail = await fn();
    results.push({ n, name, ok: true, detail });
    console.log(`PASS  ${String(n).padStart(2)}. ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    results.push({ n, name, ok: false, detail: e.message });
    console.log(`FAIL  ${String(n).padStart(2)}. ${name} — ${e.message}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const me = new Client();
let recId = null;

const health = await new Client().req("GET", "/api/health");
console.log(`Server ${BASE}: health ${health.status} ${JSON.stringify(health.json?.data ?? health.json)}`);

await step(1, "New user registration", async () => {
  const r = await me.req("POST", "/api/auth/register", { name: "E2E Tester", email: EMAIL, password: PW });
  expect(r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  expect(r.json.data.user.role === "USER", "role is not USER");
  return `account created, email delivery: ${r.json.data.verification.delivery}`;
});
await step(2, "Successful login", async () => {
  const c = new Client();
  const r = await c.req("POST", "/api/auth/login", { email: EMAIL, password: PW });
  expect(r.status === 200, `HTTP ${r.status}`);
  expect((await c.req("GET", "/api/auth/sessions")).status === 200, "session not usable");
  return "session works";
});
await step(3, "Invalid login is refused with a generic message", async () => {
  const r = await new Client().req("POST", "/api/auth/login", { email: EMAIL, password: "wrong-password-123" });
  expect(r.status === 401, `HTTP ${r.status}`);
  return r.json.error.message;
});
await step(4, "Logout revokes the session", async () => {
  const r = await me.req("POST", "/api/auth/logout");
  expect(r.status === 200, `HTTP ${r.status}`);
  expect((await me.req("GET", "/api/auth/sessions")).status === 401, "session still usable after logout");
  return "old cookie refused";
});
await step(5, "Login again", async () => {
  const r = await me.req("POST", "/api/auth/login", { email: EMAIL, password: PW });
  expect(r.status === 200, `HTTP ${r.status}`);
});
await step(6, "Create body measurement profile", async () => {
  expect((await me.req("PATCH", "/api/profile", { fitCategory: "MEN", preferredUnit: "CM", fitPreference: "REGULAR" })).status === 200, "profile update failed");
  const r = await me.req("PUT", "/api/measurements", { unit: "CM", heightCm: 176, chestCm: 96, waistCm: 84, hipsCm: 97, shoulderCm: 45 });
  expect(r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  return "chest 96 cm, waist 84 cm";
});
await step(7, "Update measurements (inches are stored as centimetres)", async () => {
  const r = await me.req("PUT", "/api/measurements", { unit: "IN", chestCm: 38, waistCm: 33 });
  expect(r.status === 200, `HTTP ${r.status}`);
  const g = await me.req("GET", "/api/measurements");
  const chest = g.json.data?.measurement?.chestCm ?? g.json.data?.chestCm;
  expect(Math.abs(chest - 96.5) < 0.2, `stored chest ${chest}`);
  return `chest stored as ${chest} cm`;
});
await step(8, "Open Brand Explorer data", async () => {
  const r = await new Client().req("GET", "/api/brands");
  expect(r.status === 200, `HTTP ${r.status}`);
  const real = r.json.data.filter((b) => !b.isDemo);
  const withData = real.filter((b) => b.charts.length);
  return `${real.length} real brands, ${withData.length} with charts (${withData.map((b) => b.slug).join(", ")})`;
});
await step(9, "Check chart verification status", async () => {
  const r = await new Client().req("GET", "/api/brands");
  const charts = r.json.data.filter((b) => !b.isDemo).flatMap((b) => b.charts);
  const verified = charts.filter((c) => c.status === "VERIFIED").length;
  return `${verified} verified, ${charts.length - verified} unverified (verification is an admin step)`;
});
await step(10, "Generate a clothing size recommendation (adidas men's T-shirt)", async () => {
  const r = await me.req("POST", "/api/recommendations", { brandSlug: "adidas", categorySlug: "tshirt", gender: "MEN", save: true });
  expect(r.status === 200 || r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  recId = r.json.data.id ?? r.json.data.recommendationId ?? null;
  expect(r.json.data.result.status === "ok", `engine status ${r.json.data.result.status}`);
  return `size ${r.json.data.result.recommendedSize}, data status ${r.json.data.chart?.status ?? r.json.data.result.dataStatus}`;
});
await step(11, "Recommendation explanation is present", async () => {
  const r = await me.req("POST", "/api/recommendations", { brandSlug: "adidas", categorySlug: "tshirt", gender: "MEN" });
  const res = r.json.data.result;
  const text = JSON.stringify(res.explanation ?? res.reasons ?? res.details ?? res);
  expect(/chest/i.test(text), "no chest reasoning in the result");
  return "explanation references chest";
});
await step(12, "Submit fit feedback", async () => {
  expect(recId, "no saved recommendation id");
  const r = await me.req("POST", "/api/feedback", { recommendationId: recId, purchasedSize: "M", outcome: "PERFECT" });
  expect(r.status === 201 || r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
});
await step(13, "Export user data (no secrets inside)", async () => {
  const r = await me.req("GET", "/api/profile/export");
  expect(r.status === 200, `HTTP ${r.status}`);
  const s = JSON.stringify(r.json);
  expect(!/passwordHash|tokenHash|\$argon2/.test(s), "export contains secrets");
  expect(s.includes(EMAIL), "export missing the account");
  return `${s.length} bytes`;
});
await step(14, "Delete the test account (password required)", async () => {
  expect((await me.req("DELETE", "/api/profile", { password: "wrong" })).status === 400, "deleted without the right password");
  const r = await me.req("DELETE", "/api/profile", { password: PW });
  expect(r.status === 200, `HTTP ${r.status}`);
  expect((await new Client().req("POST", "/api/auth/login", { email: EMAIL, password: PW })).status === 401, "deleted account can still log in");
});
await step(15, "Unauthorized access is blocked", async () => {
  const anon = new Client();
  const paths = [["GET", "/api/measurements"], ["GET", "/api/profile/export"], ["POST", "/api/recommendations"], ["GET", "/api/admin/users"]];
  const statuses = [];
  for (const [m, p] of paths) statuses.push((await anon.req(m, p, m === "POST" ? {} : undefined)).status);
  expect(statuses.every((s) => s === 401 || s === 403), `got ${statuses.join(",")}`);
  return statuses.join(", ");
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed.`);
process.exit(failed.length ? 1 : 0);
