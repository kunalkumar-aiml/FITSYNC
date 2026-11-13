import { describe, expect, it } from "vitest";
import { htmlTableAdapter } from "../adapters/html-table";
import { detectUnitFromText } from "../extraction/semantics";
import { runTargets, semanticsFor } from "../ingestion/runner";
import { outcomeToStored } from "../ingestion/merge";
import { buildQueries, classify, discoverSources } from "../discovery";
import { fetchPage } from "../safe-fetch";
import type { PageResult, Target } from "../types";

const target = (over: Partial<Target> = {}): Target => ({ brand: "nike", category: "tshirt", gender: "MEN", region: "GLOBAL", url: "https://www.nike.com/size-fit/test", ...over });
const ok = (body: string): PageResult => ({ ok: true, status: 200, body, finalUrl: "https://www.nike.com/size-fit/test" });
const NO_UNIT = `<p>Body measurements.</p><table><tr><th>Size</th><th>S</th><th>M</th><th>L</th></tr><tr><td>Chest</td><td>90</td><td>96</td><td>102</td></tr><tr><td>Waist</td><td>76</td><td>82</td><td>88</td></tr></table>`;
const PAGE_SAYS_INCHES = `<p>Body measurements. All measurements are in inches.</p>${NO_UNIT.replace("<p>Body measurements.</p>", "").replace(/90|96|102/g, (m) => String(Math.round(+m / 2.54)))}`;

describe("units are never assumed", () => {
  it("an unstated unit is UNKNOWN and needs a person; nothing is converted or stored", async () => {
    const r = htmlTableAdapter.extract({ url: new URL("https://www.nike.com/x"), body: NO_UNIT, target: target() });
    expect(r.status).toBe("NEEDS_HUMAN_VERIFICATION");
    expect(r.chart!.unit).toBe("UNKNOWN");
    const [o] = await runTargets([target()], { getPage: async () => ok(NO_UNIT) });
    expect(o.status).toBe("NEEDS_HUMAN_VERIFICATION");
    expect(o.rowsCm).toBeUndefined();
    expect(outcomeToStored(o)).toBeNull();
  });
  it("uses a unit the page states in words, with evidence", () => {
    const r = htmlTableAdapter.extract({ url: new URL("https://www.nike.com/x"), body: PAGE_SAYS_INCHES, target: target() });
    expect(r.chart!.unit).toBe("IN");
    expect(r.chart!.unitEvidence).toMatch(/inches/);
    expect(detectUnitFromText("Size chart values shown in cm")?.unit).toBe("CM");
    expect(detectUnitFromText("Switch between cm and inches")).toBeNull();
  });
});

describe("stored meaning and cut", () => {
  it("records per-dimension semantics, with straight measurements distinct from circumferences", () => {
    expect(semanticsFor({ columnLabels: { chest: "Chest", shoulder: "Shoulder", garmentLength: "Length" }, ambiguousDimensions: [], measurementType: "BODY" }))
      .toEqual({ chest: "BODY_CIRCUMFERENCE", shoulder: "BODY_LINEAR", garmentLength: "GARMENT_LENGTH" });
    expect(semanticsFor({ columnLabels: { chest: "Chest" }, ambiguousDimensions: [], measurementType: "UNKNOWN" })).toEqual({ chest: "AMBIGUOUS" });
  });
  it("keeps UNKNOWN meaning and an unstated cut as UNKNOWN in charts.json", async () => {
    const html = `<p>All measurements are in cm.</p>${NO_UNIT.replace("<p>Body measurements.</p>", "")}`;
    const [o] = await runTargets([target()], { getPage: async () => ok(html) });
    const s = outcomeToStored(o)!;
    expect(s.measurementType).toBe("UNKNOWN");
    expect(s.fitCut).toBe("UNKNOWN");
  });
});

describe("PDF sources", () => {
  it("are reported as unsupported instead of being parsed badly", async () => {
    const f = (async (u: string) => (String(u).endsWith("robots.txt") ? new Response("", { status: 404 }) : new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } }))) as unknown as typeof fetch;
    const r = await fetchPage("https://www.nike.com/guide.pdf", { fetchImpl: f, resolver: async () => ["93.184.216.34"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/PDF/);
  });
});

describe("source discovery", () => {
  it("is honest when no search API is configured", async () => {
    const r = await discoverSources({ brandName: "Nike", brandSlug: "nike", category: "tshirt", gender: "MEN" }, { provider: null });
    expect(r.configured).toBe(false);
    expect(r.candidates).toEqual([]);
  });
  it("only proposes allow-listed URLs the search API actually returned, deduplicated and classified", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "k";
    const f = (async () => new Response(JSON.stringify({ web: { results: [
      { url: "https://www.nike.com/size-fit/mens-tops-alpha", title: "Men's tops size chart" },
      { url: "https://www.nike.com/size-fit/mens-tops-alpha#x", title: "dup" },
      { url: "https://evil.example.com/nike-size", title: "Copy" },
      { url: "http://www.nike.com/insecure", title: "http" },
      { url: "https://www.myntra.com/tshirts/nike/123/buy", title: "Listing" },
    ] } }), { status: 200 })) as unknown as typeof fetch;
    const r = await discoverSources({ brandName: "Nike", brandSlug: "nike", category: "tshirt", gender: "MEN" }, { provider: "brave", fetchImpl: f });
    expect(r.candidates.map((c) => c.url)).toEqual(["https://www.nike.com/size-fit/mens-tops-alpha", "https://www.myntra.com/tshirts/nike/123/buy"]);
    expect(r.candidates[0].kind).toBe("OFFICIAL_SIZE_GUIDE");
    expect(r.candidates[1].kind).toBe("MARKETPLACE_LISTING");
  });
  it("builds site-restricted queries for a brand's own domains", () => {
    expect(buildQueries({ brandName: "Nike", brandSlug: "nike", category: "tshirt", gender: "WOMEN" })[0]).toBe("site:nike.com size guide women t-shirt");
    expect(classify(new URL("https://www.flipkart.com/x"), "nike")).toBe("MARKETPLACE_LISTING");
  });
});
