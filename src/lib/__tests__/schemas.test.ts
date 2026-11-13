import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  emailField, registerSchema, adminUserUpdateSchema, chartVersionSchema, editVersionSchema, httpsUrl,
  userSearchSchema, measurementsSchema, researchTargetSchema, decisionSchema,
} from "../schemas";
import { handleError } from "../api";

/**
 * Characterization tests for the request schemas. They pin the behaviour the API contract relies on
 * (messages, defaults, optional keys, coercion) so a validation-library upgrade cannot change it silently.
 * The same assertions pass on Zod 3.25 and Zod 4.
 */
const messages = (r: { success: boolean; error?: ZodError }) => (r.success ? [] : r.error!.issues.map((i) => i.message));
const paths = (r: { success: boolean; error?: ZodError }) => (r.success ? [] : r.error!.issues.map((i) => i.path.join(".")));

const validChart = {
  brandSlug: "nike", categorySlug: "t-shirts", fitCut: "REGULAR", measurementType: "BODY", originalUnit: "CM",
  rows: [{ label: "S", chest: 90 }, { label: "M", chest: 96 }],
};

describe("email", () => {
  it("normalises (NFKC, trim, lower-case)", () => {
    expect(emailField.parse("  Foo@Example.COM ")).toBe("foo@example.com");
  });
  it("rejects a malformed address with the custom message", () => {
    expect(messages(emailField.safeParse("not-an-email"))).toContain("Enter a valid email address.");
  });
});

describe("registration / password", () => {
  it("reports a weak password on the password field", () => {
    const r = registerSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(r.success).toBe(false);
    expect(paths(r)).toContain("password");
  });
});

describe("admin user update", () => {
  const base = { role: "USER", reason: "because" };
  it("requires confirm to be exactly true, with the custom message", () => {
    expect(messages(adminUserUpdateSchema.safeParse({ ...base, confirm: false }))).toContain("Confirm this change.");
    expect(messages(adminUserUpdateSchema.safeParse(base))).toContain("Confirm this change.");
    expect(adminUserUpdateSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });
  it("requires a reason of at least 3 characters", () => {
    expect(messages(adminUserUpdateSchema.safeParse({ confirm: true, reason: "ab" }))).toContain("Say why (saved to the audit log).");
  });
});

describe("chart version", () => {
  it("accepts a minimal chart and applies defaults", () => {
    const v = chartVersionSchema.parse(validChart);
    expect(v).toMatchObject({ gender: "UNISEX", region: "GLOBAL", productLine: "", sourceType: "MANUAL_ENTRY", ambiguousDimensions: [] });
  });
  it("never assumes a cut or a unit: both must be stated", () => {
    const { fitCut: _f, ...noCut } = validChart;
    const { originalUnit: _u, ...noUnit } = validChart;
    expect(messages(chartVersionSchema.safeParse(noCut))).toContain("Say which cut the source states, or Unknown.");
    expect(messages(chartVersionSchema.safeParse(noUnit))).toContain("Choose the unit the source uses.");
  });
  it("an invalid (not missing) cut gets the library message, not the 'required' one", () => {
    const m = messages(chartVersionSchema.safeParse({ ...validChart, fitCut: "BAGGY" }));
    expect(m.length).toBeGreaterThan(0);
    expect(m).not.toContain("Say which cut the source states, or Unknown.");
  });
  it("needs at least two sizes", () => {
    expect(messages(chartVersionSchema.safeParse({ ...validChart, rows: [{ label: "S", chest: 90 }] }))).toContain("Add at least two sizes.");
  });
  it("rejects non-positive and infinite dimensions", () => {
    expect(chartVersionSchema.safeParse({ ...validChart, rows: [{ label: "S", chest: 0 }, { label: "M", chest: 96 }] }).success).toBe(false);
    expect(chartVersionSchema.safeParse({ ...validChart, rows: [{ label: "S", chest: Infinity }, { label: "M", chest: 96 }] }).success).toBe(false);
  });
});

describe("edit version: resolveSemantics is a PARTIAL record", () => {
  const note = "resolved from the size guide";
  it("accepts a single dimension (Zod 4 z.record would demand all eight)", () => {
    expect(editVersionSchema.safeParse({ note, resolveSemantics: { chest: "BODY_CIRCUMFERENCE" } }).success).toBe(true);
  });
  it("rejects an unknown dimension and an unknown meaning", () => {
    expect(editVersionSchema.safeParse({ note, resolveSemantics: { foot: "BODY_LINEAR" } }).success).toBe(false);
    expect(editVersionSchema.safeParse({ note, resolveSemantics: { chest: "NONSENSE" } }).success).toBe(false);
  });
});

describe("https-only links", () => {
  it("accepts https and refuses http / javascript: / junk", () => {
    expect(httpsUrl.safeParse("https://example.com/size-guide").success).toBe(true);
    expect(messages(httpsUrl.safeParse("http://example.com"))).toContain("Use an https:// link.");
    expect(httpsUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpsUrl.safeParse("not a url").success).toBe(false);
  });
});

describe("pagination / search", () => {
  it("defaults the page to 1 and coerces strings", () => {
    expect(userSearchSchema.parse({ q: undefined, page: undefined }).page).toBe(1);
    expect(userSearchSchema.parse({ page: "5" }).page).toBe(5);
  });
  it("refuses page 0, fractions and absurd pages", () => {
    for (const page of ["0", "1.5", "1001"]) expect(userSearchSchema.safeParse({ page }).success).toBe(false);
  });
});

describe("measurements", () => {
  it("defaults the unit to CM and allows null / missing dimensions", () => {
    const m = measurementsSchema.parse({ chestCm: null, waistCm: 80 });
    expect(m.unit).toBe("CM");
    expect(m.chestCm).toBeNull();
    expect(m.hipsCm).toBeUndefined();
  });
  it("rejects zero, negative and infinite values", () => {
    for (const v of [0, -5, Infinity, 301]) expect(measurementsSchema.safeParse({ chestCm: v }).success).toBe(false);
  });
});

describe("research targets and decisions", () => {
  it("refuses a URL that points at a private address", () => {
    const r = researchTargetSchema.safeParse({ brand: "nike", category: "t-shirts", gender: "MEN", url: "http://127.0.0.1/admin" });
    expect(r.success).toBe(false);
    expect(paths(r)).toContain("url");
  });
  it("requires a note for anything but APPROVE", () => {
    expect(paths(decisionSchema.safeParse({ action: "REJECT" }))).toContain("note");
    expect(decisionSchema.safeParse({ action: "APPROVE" }).success).toBe(true);
  });
});

describe("API error shape", () => {
  it("turns a ZodError into a 400 with fieldErrors keyed by field", async () => {
    const r = emailField.safeParse("nope");
    const res = handleError(new ZodError(r.error!.issues));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Please check the highlighted fields.");
    expect(body.error.details).toBeTypeOf("object");
    expect(Array.isArray(body.error.details)).toBe(false);
  });
  it("keeps field names for object schemas", async () => {
    const r = adminUserUpdateSchema.safeParse({ reason: "ab" });
    const res = handleError(new ZodError(r.error!.issues));
    const body = await res.json();
    expect(Object.keys(body.error.details)).toEqual(expect.arrayContaining(["confirm", "reason"]));
  });
});
