import { readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPECTED_LATEST_MIGRATION, configProblems } from "../readiness";
import { ConfigError, errorKind, handleError } from "../api";

describe("deployment readiness", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("expects the newest migration folder (update EXPECTED_LATEST_MIGRATION when adding a migration)", () => {
    const dirs = readdirSync(path.resolve(__dirname, "../../../prisma/migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(EXPECTED_LATEST_MIGRATION).toBe(dirs[dirs.length - 1]);
  });

  it("flags a missing AUTH_SECRET in production only", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(configProblems()).toContain("AUTH_SECRET_MISSING");
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    expect(configProblems()).toEqual([]);
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(configProblems()).toEqual([]);
  });

  it("flags a missing DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(configProblems()).toContain("DATABASE_URL_MISSING");
  });
});

describe("error classification", () => {
  it("recognises configuration, connection, schema and unique-constraint failures", () => {
    expect(errorKind(new ConfigError("AUTH_SECRET_MISSING", "x"))).toBe("config");
    expect(errorKind(Object.assign(new Error("The column `User.passwordChangedAt` does not exist in the current database."), { code: "P2022" }))).toBe("db_schema");
    expect(errorKind(Object.assign(new Error("x"), { code: "P2021" }))).toBe("db_schema");
    expect(errorKind(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {}))).toBe("db_unreachable");
    expect(errorKind(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe("conflict");
    expect(errorKind(new TypeError("boom"))).toBe("unknown");
  });

  it("answers misconfiguration with 503 and a user-friendly message, never internal details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleError(new ConfigError("AUTH_SECRET_MISSING", "AUTH_SECRET must be set (min 32 chars)"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.message).toMatch(/temporarily unavailable/);
    expect(JSON.stringify(body)).not.toMatch(/AUTH_SECRET/);
    const schema = handleError(Object.assign(new Error('column "passwordChangedAt" does not exist'), { code: "P2022" }));
    expect(schema.status).toBe(503);
    const unknown = await handleError(new Error("secret internal detail")).json();
    expect(JSON.stringify(unknown)).not.toMatch(/secret internal detail/);
    expect(unknown.error.details.ref).toMatch(/^[A-Z0-9]{4,8}$/);
    spy.mockRestore();
  });
});
