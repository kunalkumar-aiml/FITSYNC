import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "../password";
import { passwordProblem } from "../password-policy";
import { csrfProblem, newCsrfToken } from "../csrf";
import { buildCsp } from "../csp";
import { clientIp, deviceLabel } from "../request-meta";
import { memoryLimiter, rateLimit, upstashLimiter } from "../../rate-limit";
import { planBootstrap, userChangeProblem } from "../../admin-policy";
import { isSessionUsable, SESSION_IDLE_MS } from "../../session-policy";
import { csvText } from "../../research/ingestion/csv-writer";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies", async () => {
    const h = await hashPassword("tailor-linen-meadow");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("tailor-linen-meadow", h)).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPassword("wrong", h)).ok).toBe(false);
  });
  it("keeps legacy bcrypt hashes working and asks for a rehash after a successful login", async () => {
    const legacy = await bcrypt.hash("old-account-password", 4);
    expect(await verifyPassword("old-account-password", legacy)).toEqual({ ok: true, needsRehash: true });
    expect(await verifyPassword("nope", legacy)).toEqual({ ok: false, needsRehash: false });
  });
  it("treats malformed hashes as a failed login, never an exception", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toEqual({ ok: false, needsRehash: false });
  });
});

describe("password policy", () => {
  it("is length-based, with no composition rules", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("all lower case words")).toBeNull();
    expect(passwordProblem("x".repeat(129))).toMatch(/at most/);
  });
  it("rejects common passwords, repeats, sequences and the user's own email or name", () => {
    expect(passwordProblem("password123")).toMatch(/common/);
    expect(passwordProblem("Password@123")).toMatch(/common/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repeat/);
    expect(passwordProblem("1234567890")).toBeTruthy();
    expect(passwordProblem("ashasharma2026!", { email: "ashasharma@example.com" })).toMatch(/email/);
    expect(passwordProblem("priyanka-rocks!", { name: "Priyanka" })).toMatch(/name/);
  });
});

describe("CSRF check", () => {
  const base = { method: "POST", allowedOrigins: ["https://fitsync.example"], origin: "https://fitsync.example", referer: null, cookieToken: "a".repeat(32), headerToken: "a".repeat(32) };
  it("accepts same-origin requests with a matching token", () => expect(csrfProblem(base)).toBeNull());
  it("ignores safe methods", () => expect(csrfProblem({ ...base, method: "GET", origin: "https://evil.example", headerToken: null })).toBeNull());
  it("rejects a foreign origin even with a valid token", () => expect(csrfProblem({ ...base, origin: "https://evil.example" })).toMatch(/Cross-origin/));
  it("rejects lookalike origins", () => expect(csrfProblem({ ...base, origin: "https://fitsync.example.evil.com" })).toBeTruthy());
  it("falls back to Referer only when Origin is absent", () => {
    expect(csrfProblem({ ...base, origin: null, referer: "https://fitsync.example/settings" })).toBeNull();
    expect(csrfProblem({ ...base, origin: null, referer: "https://evil.example/x" })).toBeTruthy();
    expect(csrfProblem({ ...base, origin: null, referer: null })).toMatch(/missing Origin/);
    expect(csrfProblem({ ...base, origin: "null", referer: null })).toBeTruthy(); // sandboxed iframes send "null"
  });
  it("requires the double-submit token to match", () => {
    expect(csrfProblem({ ...base, headerToken: null })).toBeTruthy();
    expect(csrfProblem({ ...base, headerToken: "b".repeat(32) })).toBeTruthy();
    expect(csrfProblem({ ...base, cookieToken: undefined })).toBeTruthy();
    expect(csrfProblem({ ...base, cookieToken: "short", headerToken: "short" })).toBeTruthy();
  });
  it("issues random URL-safe tokens", () => {
    const a = newCsrfToken(), b = newCsrfToken();
    expect(a).not.toBe(b); expect(a).toMatch(/^[\w-]{30,}$/);
  });
});

describe("content security policy", () => {
  it("uses a nonce and strict-dynamic, without unsafe-inline or unsafe-eval for scripts in production", () => {
    const csp = buildCsp("abc123", false, true);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildCsp("n", false, false)).not.toContain("upgrade-insecure-requests");
    expect(buildCsp("n", true)).toContain("'unsafe-eval'"); // development (React refresh) only
  });
});

describe("client IP", () => {
  it("ignores spoofable proxy headers unless a trusted proxy is configured", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4" });
    vi.stubEnv("TRUST_PROXY", ""); vi.stubEnv("VERCEL", "");
    expect(clientIp(h)).toBe("unknown");
    vi.stubEnv("TRUST_PROXY", "true");
    expect(clientIp(h)).toBe("1.2.3.4");
    vi.unstubAllEnvs();
  });
  it("labels devices without exposing the raw user agent", () => {
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile")).toBe("Chrome on Android");
    expect(deviceLabel(null)).toBe("Unknown device");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then 429", async () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60_000, memoryLimiter);
    await expect(rateLimit(key, 3, 60_000, memoryLimiter)).rejects.toMatchObject({ status: 429 });
  });
  it("talks to Upstash with INCR + PEXPIRE NX in one pipeline, and hashes keys", async () => {
    const calls: { url: string; body: unknown; auth: string | null }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify([{ result: 2 }, { result: 0 }]), { status: 200 });
    }) as unknown as typeof fetch;
    const l = upstashLimiter("https://x.upstash.io/", "tok", fake);
    await rateLimit("login:email:someone@example.com", 5, 60_000, l);
    expect(calls[0].url).toBe("https://x.upstash.io/pipeline");
    expect(calls[0].auth).toBe("Bearer tok");
    const [[incr, key], [px, key2, ms, nx]] = calls[0].body as string[][];
    expect([incr, px, ms, nx]).toEqual(["INCR", "PEXPIRE", "60000", "NX"]);
    expect(key).toBe(key2);
    expect(key).not.toContain("someone@example.com");
  });
  it("falls back to memory when the shared store fails, instead of failing open", async () => {
    const broken = { hit: async () => { throw new Error("down"); } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = `f-${Math.random()}`;
    await rateLimit(key, 1, 60_000, broken);
    await expect(rateLimit(key, 1, 60_000, broken)).rejects.toMatchObject({ status: 429 });
    warn.mockRestore();
  });
});

describe("administrator policy", () => {
  const user = { id: "u1", role: "USER" as const, emailVerifiedAt: new Date(), disabledAt: null };
  const admin = { id: "a2", role: "ADMIN" as const, emailVerifiedAt: new Date(), disabledAt: null };
  it("never lets an admin change themselves", () => expect(userChangeProblem({ actorId: "a2", target: admin, activeAdmins: 3, role: "USER" })).toMatch(/your own/));
  it("only promotes confirmed emails", () => {
    expect(userChangeProblem({ actorId: "a1", target: { ...user, emailVerifiedAt: null }, activeAdmins: 1, role: "ADMIN" })).toMatch(/confirmed email/);
    expect(userChangeProblem({ actorId: "a1", target: user, activeAdmins: 1, role: "ADMIN" })).toBeNull();
  });
  it("keeps at least one active admin", () => {
    expect(userChangeProblem({ actorId: "a1", target: admin, activeAdmins: 1, role: "USER" })).toMatch(/last active/);
    expect(userChangeProblem({ actorId: "a1", target: admin, activeAdmins: 1, disabled: true })).toMatch(/last active/);
    expect(userChangeProblem({ actorId: "a1", target: admin, activeAdmins: 2, role: "USER" })).toBeNull();
  });
  it("bootstrap is closed as soon as any admin exists, and never silently promotes an existing account", () => {
    expect(planBootstrap({ adminCount: 1, existing: null, confirmExisting: true }).action).toBe("refuse");
    expect(planBootstrap({ adminCount: 0, existing: null, confirmExisting: false }).action).toBe("create");
    expect(planBootstrap({ adminCount: 0, existing: { id: "x", role: "USER" }, confirmExisting: false }).action).toBe("refuse");
    expect(planBootstrap({ adminCount: 0, existing: { id: "x", role: "USER" }, confirmExisting: true })).toEqual({ action: "promote", userId: "x" });
  });
});

describe("sessions", () => {
  const now = Date.now();
  it("expire on revocation, absolute expiry, and idleness", () => {
    const s = { expiresAt: new Date(now + 1000), lastSeenAt: new Date(now), revokedAt: null };
    expect(isSessionUsable(s, now)).toBe(true);
    expect(isSessionUsable({ ...s, revokedAt: new Date(now) }, now)).toBe(false);
    expect(isSessionUsable({ ...s, expiresAt: new Date(now - 1) }, now)).toBe(false);
    expect(isSessionUsable({ ...s, lastSeenAt: new Date(now - SESSION_IDLE_MS - 1) }, now)).toBe(false);
  });
});

describe("CSV export safety", () => {
  it("neutralises spreadsheet formulas and escapes quotes", () => {
    expect(csvText("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvText("M")).toBe(`"M"`);
  });
});
