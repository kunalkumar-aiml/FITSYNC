import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCategoryConfig, normalizeMeasurements, recommend, type ChartRow, type FitPreference, type SizeChart } from "..";

type Src = { brand: string; category: string; gender: string; region: string; measurementType: "BODY" | "GARMENT"; unit: "CM" | "IN"; sourceUrl: string; sourceType: string; rows: Record<string, number | string>[] };
const data = JSON.parse(readFileSync(join(__dirname, "../../../../prisma/data/charts.json"), "utf8")) as { charts: Src[]; unavailable: { brand: string }[] };

// Same unit conversion the seed performs
const toChart = (c: Src, status: SizeChart["status"] = "VERIFIED"): SizeChart => ({
  measurementType: c.measurementType, status,
  rows: c.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "label" ? v : Math.round((c.unit === "IN" ? (v as number) * 2.54 : (v as number)) * 10) / 10]))) as ChartRow[],
});
const find = (brand: string, gender: string, region?: string) => data.charts.find((c) => c.brand === brand && c.gender === gender && (!region || c.region === region))!;
const tshirt = getCategoryConfig("tshirt")!;

describe("real sourced data rules", () => {
  it("every real chart records an official source and is a known type", () => {
    for (const c of data.charts) {
      expect(c.sourceUrl).toMatch(/^https:\/\//);
      expect(["OFFICIAL_SITE", "OFFICIAL_PDF", "STORE_MEASURED", "MANUAL_ENTRY"]).toContain(c.sourceType);
      expect(c.sourceType).not.toBe("DEMO");
      expect(c.rows.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("official brand charts never reuse the fictional demo numbers", () => {
    const demoChests = new Set([96, 102, 108, 114, 100, 106, 112, 118, 92, 98, 104, 110]);
    for (const c of data.charts) {
      const asCm = toChart(c).rows.map((r) => r.chest);
      expect(asCm.every((v) => demoChests.has(v as number)) && asCm.length === 4).toBe(false);
    }
  });
  it("brands without official data are recorded as unavailable, not given charts", () => {
    const withCharts = new Set(data.charts.map((c) => c.brand));
    for (const brand of ["zara", "hm", "uniqlo", "levis", "adidas", "puma", "bewakoof", "snitch", "the-souled-store", "max-fashion", "westside"]) {
      expect(withCharts.has(brand)).toBe(false);
      expect(data.unavailable.some((u) => u.brand === brand)).toBe(true);
    }
  });
  it("men's and women's charts are separate records", () => {
    expect(find("nike", "MEN", "GLOBAL").rows.length).not.toBe(0);
    expect(find("nike", "WOMEN", "GLOBAL")).toBeTruthy();
    expect(find("nike", "MEN", "GLOBAL").sourceUrl).not.toBe(find("nike", "WOMEN", "GLOBAL").sourceUrl);
  });
});

describe("recommendations from real charts", () => {
  const body = normalizeMeasurements({ chest: 98, waist: 84, shoulder: 45, hips: 96 }, "CM");

  it("Nike men's alpha (BODY ranges): 98 cm chest is M (37.5-41 in = 95.3-104.1 cm)", () => {
    const r = recommend({ body, chart: toChart(find("nike", "MEN", "GLOBAL")), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.recommendedSize).toBe("M");
      expect(r.achievedFit).toBeNull(); // body chart: real fit depends on the garment cut
      expect(r.explanation).toContain("inside the range");
    }
  });
  it("fit preference moves the size on a body-range chart (relaxed sizes up)", () => {
    const chart = toChart(find("nike", "MEN", "GLOBAL"));
    const sizeFor = (p: FitPreference) => { const r = recommend({ body, chart, category: tshirt, fitPreference: p }); return r.status === "ok" ? r.recommendedSize : r.status; };
    expect(sizeFor("REGULAR")).toBe("M");
    expect(sizeFor("OVERSIZED")).toBe("L");
  });
  it("men's and women's charts give different results for the same body", () => {
    const men = recommend({ body, chart: toChart(find("nike", "MEN", "GLOBAL")), category: tshirt, fitPreference: "REGULAR" });
    const women = recommend({ body, chart: toChart(find("nike", "WOMEN", "GLOBAL")), category: tshirt, fitPreference: "REGULAR" });
    expect(men.status).toBe("ok"); expect(women.status).toBe("ok");
    if (men.status === "ok" && women.status === "ok") expect(men.recommendedSize).not.toBe(women.recommendedSize);
  });
  it("regional sizing systems differ (Nike Asian vs global men's)", () => {
    const g = recommend({ body, chart: toChart(find("nike", "MEN", "GLOBAL")), category: tshirt, fitPreference: "REGULAR" });
    const a = recommend({ body, chart: toChart(find("nike", "MEN", "ASIA")), category: tshirt, fitPreference: "REGULAR" });
    expect(g.status).toBe("ok"); expect(a.status).toBe("ok");
    if (g.status === "ok" && a.status === "ok") expect(g.recommendedSize).not.toBe(a.recommendedSize);
  });
  it("inches input gives the same result as centimetres", () => {
    const inches = normalizeMeasurements({ chest: 38.58, waist: 33.07, shoulder: 17.72, hips: 37.8 }, "IN");
    const chart = toChart(find("nike", "MEN", "GLOBAL"));
    const a = recommend({ body, chart, category: tshirt, fitPreference: "REGULAR" });
    const b = recommend({ body: inches, chart, category: tshirt, fitPreference: "REGULAR" });
    expect(a.status === "ok" && b.status === "ok" && a.recommendedSize === b.recommendedSize).toBe(true);
  });
  it("unverified real charts cap confidence and warn", () => {
    const r = recommend({ body, chart: toChart(find("nike", "MEN", "GLOBAL"), "UNVERIFIED"), category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.confidence).toBeLessThanOrEqual(0.55);
    expect(r.warnings.join(" ")).toMatch(/not verified/);
  });
  it("a chest far outside any size is no_compatible_size, not a forced pick", () => {
    const r = recommend({ body: { chest: 150 }, chart: toChart(find("nike", "WOMEN", "GLOBAL")), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("no_compatible_size");
  });
  it("missing chest -> insufficient_data (no recommendation invented)", () => {
    const r = recommend({ body: { waist: 84 }, chart: toChart(find("nike", "MEN", "GLOBAL")), category: tshirt, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
  });
  it("trousers need waist; a tops-only chart cannot size jeans", () => {
    const r = recommend({ body, chart: { ...toChart(find("nike", "MEN", "GLOBAL")), rows: [{ label: "M", chest: 100 }, { label: "L", chest: 106 }] }, category: getCategoryConfig("jeans")!, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
  });
  it("garment cut, preferred fit and achieved fit are three separate things", () => {
    const relaxedCut: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", garmentCut: "RELAXED", rows: [{ label: "M", chest: 110 }, { label: "L", chest: 116 }] };
    const r = recommend({ body: { chest: 98 }, chart: relaxedCut, category: tshirt, fitPreference: "REGULAR" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.garmentCut).toBe("RELAXED");   // what the brand sells
    expect(r.fitPreference).toBe("REGULAR"); // what the shopper asked for
    expect(r.achievedFit).toBe("REGULAR");   // what this size should actually give (+12 cm ease)
  });
  it("a slim-fit shopper is told when a brand only offers a relaxed-cut garment", () => {
    const relaxedCut: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", garmentCut: "RELAXED", rows: [{ label: "M", chest: 112 }, { label: "L", chest: 118 }] };
    const r = recommend({ body: { chest: 98 }, chart: relaxedCut, category: tshirt, fitPreference: "SLIM" });
    expect(r.status).toBe("no_compatible_size");
  });
  it("brand comparison: same body, per-brand charts give independent results", () => {
    const results = ["MEN", "WOMEN"].map((g) => recommend({ body, chart: toChart(find("nike", g, "GLOBAL")), category: tshirt, fitPreference: "REGULAR" }));
    expect(results.every((r) => r.status === "ok")).toBe(true);
  });
});
