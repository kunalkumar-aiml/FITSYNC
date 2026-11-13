import { describe, expect, it } from "vitest";
import { getCategoryConfig, normalizeSemanticCode, parseSemantics, recommend, semanticFor, type SizeChart } from "..";

const tee = getCategoryConfig("tshirt")!;
const rows = [{ label: "S", chest: 96, shoulder: 42 }, { label: "M", chest: 102, shoulder: 44 }, { label: "L", chest: 108, shoulder: 46 }];
const base: SizeChart = { measurementType: "GARMENT", status: "VERIFIED", rows };

describe("dimension-specific measurement semantics", () => {
  it("never treats an UNKNOWN chart as garment measurements", () => {
    const r = recommend({ body: { chest: 94 }, chart: { ...base, measurementType: "UNKNOWN" }, category: tee, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
    if (r.status === "insufficient_data") expect(r.explanation).toMatch(/ambiguous/);
    expect(semanticFor({ measurementType: "UNKNOWN" }, "chest")).toBe("AMBIGUOUS");
    expect(semanticFor({ measurementType: "MIXED" }, "chest")).toBe("AMBIGUOUS");
  });
  it("uses explicit per-dimension meaning over the chart-level type", () => {
    const chart: SizeChart = { ...base, measurementType: "UNKNOWN", semantics: { chest: "GARMENT", shoulder: "BODY" } };
    const r = recommend({ body: { chest: 92, shoulder: 44 }, chart, category: tee, fitPreference: "REGULAR" });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      const best = r.ranking[0];
      expect(best.dimensions.find((d) => d.dimension === "chest")!.semantic).toBe("GARMENT");
      expect(best.dimensions.find((d) => d.dimension === "shoulder")!.semantic).toBe("BODY");
      expect(r.explanation).toMatch(/body-size values are compared with yours directly/);
    }
  });
  it("never compares a flat garment width with a body circumference", () => {
    const flat: SizeChart = { ...base, rows: [{ label: "S", chest: 48 }, { label: "M", chest: 51 }, { label: "L", chest: 54 }], semantics: { chest: "GARMENT_FLAT" } };
    const r = recommend({ body: { chest: 94 }, chart: flat, category: tee, fitPreference: "REGULAR" });
    expect(r.status).toBe("insufficient_data");
    if (r.status === "insufficient_data") { expect(r.explanation).toMatch(/flat garment width/); expect(r.excluded?.[0]).toEqual({ dimension: "chest", reason: "FLAT_WIDTH" }); }
  });
  it("skips an optional flat dimension with a warning but still recommends from the rest", () => {
    const chart: SizeChart = { ...base, semantics: { shoulder: "GARMENT_FLAT" } };
    const r = recommend({ body: { chest: 94, shoulder: 44 }, chart, category: tee, fitPreference: "REGULAR" });
    expect(r.status).toBe("ok");
    if (r.status === "ok") { expect(r.excluded).toEqual([{ dimension: "shoulder", reason: "FLAT_WIDTH" }]); expect(r.provisional).toBe(true); expect(r.warnings.join(" ")).toMatch(/flat garment width/); }
  });
  it("does not turn an unknown garment cut into REGULAR", () => {
    const r = recommend({ body: { chest: 94 }, chart: { ...base, garmentCut: "UNKNOWN" }, category: tee, fitPreference: "REGULAR" });
    expect(r.status === "ok" && r.garmentCut).toBeNull();
    const s = recommend({ body: { chest: 94 }, chart: { ...base, garmentCut: "SLIM" }, category: tee, fitPreference: "REGULAR" });
    expect(s.status === "ok" && s.garmentCut).toBe("SLIM");
  });
  it("refuses charts that are awaiting review, invalid or retired", () => {
    for (const status of ["NEEDS_HUMAN_VERIFICATION", "INVALID", "DEPRECATED"] as const) {
      expect(recommend({ body: { chest: 94 }, chart: { ...base, status }, category: tee, fitPreference: "REGULAR" }).status).toBe("insufficient_data");
    }
  });
  it("maps stored codes conservatively", () => {
    expect(normalizeSemanticCode("BODY_CIRCUMFERENCE")).toBe("BODY");
    expect(normalizeSemanticCode("GARMENT_LINEAR")).toBe("GARMENT");
    expect(normalizeSemanticCode("GARMENT_WIDTH_FLAT")).toBe("GARMENT_FLAT");
    expect(normalizeSemanticCode("SOMETHING_NEW")).toBe("AMBIGUOUS");
    expect(parseSemantics({ chest: "BODY_CIRCUMFERENCE", length: 3 })).toEqual({ chest: "BODY" });
    expect(parseSemantics(null)).toEqual({});
  });
});
