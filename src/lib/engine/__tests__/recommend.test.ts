import { describe, expect, it } from "vitest";
import { getCategoryConfig, normalizeMeasurements, recommend, validateBody } from "..";
import type { SizeChart } from "..";

const tshirt = getCategoryConfig("tshirt")!;
const jeans = getCategoryConfig("jeans")!;

// Test fixture only — NOT real brand data.
const garmentChart = (status: SizeChart["status"] = "VERIFIED"): SizeChart => ({
  measurementType: "GARMENT",
  status,
  rows: [
    { label: "S", chest: 96, shoulder: 42, waist: 94 },
    { label: "M", chest: 102, shoulder: 44, waist: 100 },
    { label: "L", chest: 108, shoulder: 46, waist: 106 },
    { label: "XL", chest: 114, shoulder: 48, waist: 112 },
  ],
});

const body = { chest: 98, shoulder: 45, waist: 84 };

describe("recommendation engine", () => {
  it("accounts for ease: same body, different fit preference, different size", () => {
    const slim = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "SLIM" });
    const regular = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    const relaxed = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "RELAXED" });
    expect(slim.status === "ok" && slim.recommendedSize).toBe("M");
    expect(regular.status === "ok" && regular.recommendedSize).toBe("L");
    expect(relaxed.status === "ok" && relaxed.recommendedSize).toBe("XL");
  });

  it("does not just pick the nearest number (chest 102 vs body 98 is only +4 ease)", () => {
    const r = recommend({ body: { chest: 102 }, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.recommendedSize).not.toBe("M");
  });

  it("is deterministic for identical inputs", () => {
    const a = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    const b = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("returns per-dimension compatibility labels and an explanation", () => {
    const r = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(Object.keys(r.compatibility).sort()).toEqual(["chest", "shoulder", "waist"]);
    expect(r.explanation).toContain(`Size ${r.recommendedSize}`);
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("flags tight and loose areas", () => {
    const r = recommend({ body: { chest: 98, waist: 84, shoulder: 45 }, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    const m = r.ranking.find((s) => s.label === "M")!;
    expect(m.dimensions.find((d) => d.dimension === "chest")!.label).toMatch(/Tight/);
  });

  it("returns insufficient_data when a required body measurement is missing", () => {
    const r = recommend({ body: { waist: 84 }, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
    if (r.status === "insufficient_data") expect(r.missing).toEqual(["chest"]);
  });

  it("returns insufficient_data when the chart lacks the required garment dimension", () => {
    const chart: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", rows: [{ label: "M", waist: 100 }] };
    const r = recommend({ body, chart, category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
  });

  it("works with only some optional measurements, lowering confidence and warning", () => {
    const full = recommend({ body, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    const partial = recommend({ body: { chest: 98 }, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    if (full.status !== "ok" || partial.status !== "ok") throw new Error("expected ok");
    expect(partial.confidence).toBeLessThan(full.confidence);
    expect(partial.warnings.join(" ")).toMatch(/measurements for this category/);
  });

  it("rejects invalid measurements", () => {
    const r = recommend({ body: { chest: 9 }, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("invalid_input");
    expect(validateBody({ chest: 98, shoulder: 120 }).length).toBeGreaterThan(0);
    expect(validateBody({ weightKg: 5 })).toHaveLength(1);
  });

  it("caps confidence and warns for unverified data", () => {
    const r = recommend({ body, chart: garmentChart("UNVERIFIED"), category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.confidence).toBeLessThanOrEqual(0.55);
    expect(r.warnings.join(" ")).toMatch(/not verified/);
    expect(r.dataStatus).toBe("UNVERIFIED");
  });

  it("refuses to recommend from deprecated charts", () => {
    const r = recommend({ body, chart: garmentChart("DEPRECATED"), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
  });

  it("reports no_compatible_size when nothing fits", () => {
    const r = recommend({ body: { chest: 150 }, chart: garmentChart(), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("no_compatible_size");
    if (r.status === "no_compatible_size") expect(r.closest?.size).toBe("XL");
  });

  it("warns when between two sizes", () => {
    // body 98, regular ease 8-14: M=+8 and L=+14 sit on opposite edges of the ideal range, so they score equally.
    const chart: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", rows: [
      { label: "M", chest: 106 }, { label: "L", chest: 112 },
    ] };
    const r = recommend({ body: { chest: 98 }, chart, category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.warnings.join(" ")).toMatch(/between M and L/);
  });

  it("treats BODY charts differently from GARMENT charts", () => {
    const chart: SizeChart = { measurementType: "BODY", status: "VERIFIED", rows: [
      { label: "S", chest: 92 }, { label: "M", chest: 98 }, { label: "L", chest: 104 },
    ] };
    const r = recommend({ body: { chest: 98 }, chart, category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.recommendedSize).toBe("M");
  });

  it("supports other categories (jeans use waist/hips/thigh/inseam)", () => {
    const chart: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", rows: [
      { label: "30", waist: 79, hips: 96, thigh: 58, inseam: 80 },
      { label: "32", waist: 84, hips: 101, thigh: 60, inseam: 80 },
      { label: "34", waist: 89, hips: 106, thigh: 62, inseam: 80 },
    ] };
    const r = recommend({ body: { waist: 81, hips: 96, thigh: 54, inseam: 80 }, chart, category: jeans, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.recommendedSize).toBe("32");
  });
});

describe("units", () => {
  it("converts inches to cm and leaves cm and weight untouched", () => {
    expect(normalizeMeasurements({ chest: 40, weightKg: 70 }, "IN")).toEqual({ chest: 101.6, weightKg: 70 });
    expect(normalizeMeasurements({ chest: 98, waist: null }, "CM")).toEqual({ chest: 98 });
  });
});
