import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_CONFIGS, getCategoryConfig, recommend, UNSUPPORTED_CATEGORIES, type ChartRow, type SizeChart } from "..";
import { rowsToCm } from "../../research/normalization/to-cm";
import { selectChart } from "../../chart-select";

const data = JSON.parse(readFileSync(join(__dirname, "../../../../prisma/data/charts.json"), "utf8")) as { charts: { brand: string; unit: "CM" | "IN"; measurementType: "BODY" | "GARMENT"; product?: unknown; ambiguousDimensions?: string[]; rows: ChartRow[] }[] };
const tee = getCategoryConfig("tshirt")!;
const body = { chest: 98, waist: 84, shoulder: 45 };

describe("Fit Match Score (experimental) — naming and honesty", () => {
  it("result exposes fitMatchScore and no calibrated 'confidence' claim", () => {
    const chart: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", rows: [{ label: "M", chest: 108 }, { label: "L", chest: 114 }] };
    const r = recommend({ body, chart, category: tee, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r).toHaveProperty("fitMatchScore");
    expect(r).not.toHaveProperty("confidence");
    expect(r.fitMatchScore).toBeGreaterThan(0); expect(r.fitMatchScore).toBeLessThanOrEqual(1);
  });
  it("is provisional on unverified or partial data, not on verified complete data", () => {
    const rows: ChartRow[] = [{ label: "M", chest: 108, shoulder: 47, waist: 104 }, { label: "L", chest: 114, shoulder: 49, waist: 110 }];
    const v = recommend({ body, chart: { measurementType: "GARMENT", status: "VERIFIED", rows }, category: tee, fitPreference: "REGULAR" });
    const u = recommend({ body, chart: { measurementType: "GARMENT", status: "UNVERIFIED", rows }, category: tee, fitPreference: "REGULAR" });
    if (v.status !== "ok" || u.status !== "ok") throw new Error("expected ok");
    expect(v.provisional).toBe(false); expect(u.provisional).toBe(true);
    expect(u.fitMatchScore).toBeLessThanOrEqual(0.55);
  });
});

describe("ambiguous measurements are never used", () => {
  const rows: ChartRow[] = [{ label: "M", chest: 100, shoulder: 45 }, { label: "L", chest: 106, shoulder: 47 }];
  it("an ambiguous REQUIRED dimension blocks the recommendation with a clear reason", () => {
    const r = recommend({ body, chart: { measurementType: "GARMENT", status: "VERIFIED", rows, ambiguousDimensions: ["chest"] }, category: tee, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
    if (r.status === "insufficient_data") expect(r.explanation).toMatch(/ambiguous/);
  });
  it("an ambiguous OPTIONAL dimension is ignored (and reported), not compared", () => {
    const base = recommend({ body, chart: { measurementType: "GARMENT", status: "VERIFIED", rows }, category: tee, fitPreference: "REGULAR" });
    const amb = recommend({ body, chart: { measurementType: "GARMENT", status: "VERIFIED", rows, ambiguousDimensions: ["shoulder"] }, category: tee, fitPreference: "REGULAR" });
    if (base.status !== "ok" || amb.status !== "ok") throw new Error("expected ok");
    expect(base.compatibility.shoulder).toBeDefined();
    expect(amb.compatibility.shoulder).toBeUndefined();
    expect(amb.ambiguousExcluded).toEqual(["shoulder"]); expect(amb.provisional).toBe(true);
  });
  it("the real marketplace product charts (meaning not stated) cannot drive a recommendation", () => {
    const products = data.charts.filter((c) => c.product);
    expect(products.length).toBeGreaterThanOrEqual(3);
    for (const p of products) {
      const chart: SizeChart = { measurementType: p.measurementType, status: "UNVERIFIED", rows: rowsToCm(p.rows, p.unit), ambiguousDimensions: p.ambiguousDimensions as never, scope: "PRODUCT" };
      expect(recommend({ body, chart, category: tee, fitPreference: "REGULAR" }).status).toBe("insufficient_data");
    }
  });
});

describe("product-specific vs brand-level charts", () => {
  const c = (id: string, productId: string | null, status: "VERIFIED" | "UNVERIFIED") => ({ id, gender: "MEN" as const, region: "IN", productLine: "", fitCut: "REGULAR", productId, status });
  it("a VERIFIED product chart overrides the brand chart for that product", () => {
    expect(selectChart([c("brand", null, "VERIFIED"), c("prod", "p1", "VERIFIED")], "MEN", "REGULAR", undefined, "p1")!.chart.id).toBe("prod");
  });
  it("an UNVERIFIED product chart does not override a verified brand chart", () => {
    expect(selectChart([c("brand", null, "VERIFIED"), c("prod", "p1", "UNVERIFIED")], "MEN", "REGULAR", undefined, "p1")!.chart.id).toBe("brand");
  });
  it("when nothing is verified the product chart (more specific) wins", () => {
    expect(selectChart([c("brand", null, "UNVERIFIED"), c("prod", "p1", "UNVERIFIED")], "MEN", "REGULAR", undefined, "p1")!.chart.id).toBe("prod");
  });
  it("another product's chart is never used, and no product chart is used without choosing the product", () => {
    expect(selectChart([c("brand", null, "VERIFIED"), c("other", "p2", "VERIFIED")], "MEN", "REGULAR", undefined, "p1")!.chart.id).toBe("brand");
    expect(selectChart([c("prod", "p1", "VERIFIED")], "MEN", "REGULAR")).toBeNull();
  });
  it("a product chart keeps gender separation", () => {
    expect(selectChart([{ ...c("prodW", "p1", "VERIFIED"), gender: "WOMEN" as const }], "MEN", "REGULAR", undefined, "p1")).toBeNull();
  });
});

describe("category-specific dimension mappings", () => {
  it("covers topwear, bottomwear and dresses, and does not pretend to support ethnic wear or co-ords", () => {
    const slugs = CATEGORY_CONFIGS.map((x) => x.slug);
    for (const s of ["tshirt", "shirt", "polo", "hoodie", "sweatshirt", "jacket", "top", "jeans", "chinos", "joggers", "shorts", "skirt", "dress"]) expect(slugs).toContain(s);
    expect(UNSUPPORTED_CATEGORIES).toContain("ethnic wear");
    expect(getCategoryConfig("ethnic wear")).toBeUndefined();
  });
  it("only body-comparable dimensions are compared (garment-only length is never scored)", () => {
    for (const cat of CATEGORY_CONFIGS) for (const d of Object.keys(cat.dimensions)) expect(["garmentLength", "sleeveLength", "rise", "legOpening"]).not.toContain(d);
  });
  it("skirt needs waist; dress needs chest/bust; shorts need waist", () => {
    const rows: ChartRow[] = [{ label: "S", hips: 100 }, { label: "M", hips: 106 }];
    expect(recommend({ body: { hips: 96, chest: 90 }, chart: { measurementType: "GARMENT", status: "VERIFIED", rows }, category: getCategoryConfig("skirt")!, fitPreference: "REGULAR" }).status).toBe("insufficient_data");
    expect(recommend({ body: { waist: 70 }, chart: { measurementType: "GARMENT", status: "VERIFIED", rows: [{ label: "S", chest: 92 }, { label: "M", chest: 98 }] }, category: getCategoryConfig("dress")!, fitPreference: "REGULAR" }).status).toBe("insufficient_data");
  });
  it("garment-only columns in a chart do not change the recommendation", () => {
    const rows: ChartRow[] = [{ label: "M", chest: 108, garmentLength: 70, sleeveLength: 22 }, { label: "L", chest: 114, garmentLength: 72, sleeveLength: 23 }];
    const a = recommend({ body, chart: { measurementType: "GARMENT", status: "VERIFIED", rows }, category: tee, fitPreference: "REGULAR" });
    const b = recommend({ body, chart: { measurementType: "GARMENT", status: "VERIFIED", rows: rows.map((r) => ({ label: r.label, chest: r.chest })) }, category: tee, fitPreference: "REGULAR" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("regional sizing", () => {
  it("different regional charts for the same brand give independent results", () => {
    const g: SizeChart = { measurementType: "BODY", status: "VERIFIED", rows: [{ label: "M", chest: 96, chestMax: 104 }, { label: "L", chest: 104, chestMax: 112 }] };
    const asia: SizeChart = { measurementType: "BODY", status: "VERIFIED", rows: [{ label: "M", chest: 91, chestMax: 98 }, { label: "L", chest: 98, chestMax: 104 }] };
    const a = recommend({ body: { chest: 100 }, chart: g, category: tee, fitPreference: "REGULAR" });
    const b = recommend({ body: { chest: 100 }, chart: asia, category: tee, fitPreference: "REGULAR" });
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");
    expect(a.recommendedSize).toBe("M"); expect(b.recommendedSize).toBe("L");
  });
});
