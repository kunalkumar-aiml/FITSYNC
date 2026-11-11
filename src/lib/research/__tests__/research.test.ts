import { describe, expect, it } from "vitest";
import { assertPublicHost, hostAllowed, isPrivateIp, UnsafeUrlError, validateResearchUrl } from "../url-safety";
import { fetchPage } from "../safe-fetch";
import { htmlTableAdapter } from "../adapters/html-table";
import { marketplaceListingAdapter } from "../adapters/marketplace-listing";
import { parseCell } from "../extraction/cells";
import { validateChart } from "../validation/validate-chart";
import { rowsToCm } from "../normalization/to-cm";
import { rowsToCsv, chartHash } from "../ingestion/csv-writer";
import { mergeCharts, outcomeToStored, type ChartsFile } from "../ingestion/merge";
import { runTargets } from "../ingestion/runner";
import { parseChartCsv } from "../../csv";
import * as F from "./fixtures";
import type { PageResult, Target } from "../types";

const target = (over: Partial<Target> = {}): Target => ({ brand: "nike", category: "tshirt", gender: "MEN", region: "GLOBAL", url: "https://www.nike.com/size-fit/test", ...over });
const ok = (body: string): PageResult => ({ ok: true, status: 200, body, finalUrl: "https://www.nike.com/size-fit/test" });
const pub = async () => ["93.184.216.34"];

describe("SSRF protection", () => {
  it("rejects non-https, credentials, odd ports, IPs, internal names and non-allowlisted hosts", () => {
    for (const bad of ["http://www.nike.com/x", "https://user:pw@www.nike.com/x", "https://www.nike.com:8443/x", "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data", "https://[::1]/x",
      "https://localhost/x", "https://intranet.local/x", "https://metadata.google.internal/x", "https://evil.example.com/x", "https://nike.com.evil.com/x", "file:///etc/passwd", "ftp://www.nike.com/x", "javascript:alert(1)", "not a url", "https://10.0.0.5/x"]) {
      expect(() => validateResearchUrl(bad), bad).toThrow(UnsafeUrlError);
    }
  });
  it("accepts allow-listed https hosts and their subdomains only", () => {
    expect(validateResearchUrl("https://www.nike.com/size-fit/mens").hostname).toBe("www.nike.com");
    expect(hostAllowed("www.flipkart.com")).toBe(true);
    expect(hostAllowed("notnike.com")).toBe(false);
  });
  it("classifies private and public IPs, including IPv4-mapped IPv6", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "127.0.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("blocks hosts whose DNS points at internal addresses (DNS rebinding style)", async () => {
    await expect(assertPublicHost("www.nike.com", async () => ["10.0.0.7"])).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHost("www.nike.com", async () => ["93.184.216.34", "127.0.0.1"])).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHost("www.nike.com", pub)).resolves.toBeUndefined();
  });
});

describe("safe fetch behaviour", () => {
  const html = (body: string, status = 200, headers: Record<string, string> = {}) => new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
  const robotsOk = (page: () => Response) => async (u: RequestInfo | URL) => (String(u).endsWith("/robots.txt") ? new Response("User-agent: *\nAllow: /", { status: 200 }) : page());
  it("returns the page for a normal response", async () => {
    const r = await fetchPage("https://www.nike.com/x", { fetchImpl: robotsOk(() => html("<table></table>")) as never, resolver: pub });
    expect(r.ok).toBe(true);
  });
  it("reports ACCESS_RESTRICTED for 403/429 and never retries around it", async () => {
    for (const code of [401, 403, 429]) {
      const r = await fetchPage("https://www.nike.com/x", { fetchImpl: robotsOk(() => html("no", code)) as never, resolver: pub });
      expect(r.ok).toBe(false); if (!r.ok) expect(r.status).toBe("ACCESS_RESTRICTED");
    }
  });
  it("treats a bot-check page as ACCESS_RESTRICTED", async () => {
    const r = await fetchPage("https://www.nike.com/x", { fetchImpl: robotsOk(() => html("<html>Please complete the CAPTCHA to continue</html>")) as never, resolver: pub });
    if (r.ok) throw new Error("expected failure"); expect(r.status).toBe("ACCESS_RESTRICTED");
  });
  it("honours robots.txt Disallow", async () => {
    const f = async (u: RequestInfo | URL) => (String(u).endsWith("/robots.txt") ? new Response("User-agent: *\nDisallow: /size-fit/", { status: 200 }) : html("x"));
    const r = await fetchPage("https://www.nike.com/size-fit/mens", { fetchImpl: f as never, resolver: pub });
    if (r.ok) throw new Error("expected failure"); expect(r.status).toBe("ACCESS_RESTRICTED"); expect(r.reason).toMatch(/robots/);
  });
  it("re-validates every redirect hop (redirect to an internal host is refused)", async () => {
    const f = async (u: RequestInfo | URL) => (String(u).endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } }));
    const r = await fetchPage("https://www.nike.com/x", { fetchImpl: f as never, resolver: pub });
    if (r.ok) throw new Error("expected failure"); expect(r.status).toBe("ACCESS_RESTRICTED");
  });
  it("rejects non-HTML content and unsafe URLs before any request", async () => {
    let called = 0;
    const f = (async () => { called++; return html("x", 200, { "content-type": "application/octet-stream" }); }) as never;
    expect((await fetchPage("http://localhost/x", { fetchImpl: f, resolver: pub })).ok).toBe(false);
    expect(called).toBe(0);
    const r = await fetchPage("https://www.nike.com/x", { fetchImpl: (async (u: string) => (String(u).endsWith("robots.txt") ? new Response("", { status: 404 }) : html("x", 200, { "content-type": "application/octet-stream" }))) as never, resolver: pub });
    expect(r.ok).toBe(false);
  });
});

describe("html table adapter", () => {
  const run = (html: string, t = target()) => htmlTableAdapter.extract({ url: new URL(t.url), body: html, target: t });
  it("extracts ranges, preserves the source unit, and takes meaning from the page text", () => {
    const r = run(F.TABLE_BODY_HTML);
    expect(r.status).toBe("SUCCESS");
    expect(r.chart!.unit).toBe("IN");
    expect(r.chart!.measurementType).toBe("BODY");
    expect(r.chart!.semanticsEvidence).toMatch(/body measurements/i);
    expect(r.chart!.rows[0]).toMatchObject({ label: "XS", chest: 30, chestMax: 32, waist: 24, waistMax: 26 });
    expect(r.chart!.ambiguousDimensions).toEqual([]);
  });
  it("maps Bust to chest but records the original label (no change of meaning)", () => {
    const r = run(F.TABLE_WOMEN_BUST_HTML, target({ gender: "WOMEN" }));
    expect(r.chart!.unit).toBe("CM");
    expect(r.chart!.columnLabels.chest).toBe("Bust");
    expect(r.chart!.rows[1]).toMatchObject({ label: "M", chest: 86, chestMax: 90, hips: 94 });
  });
  it("handles sizes down the first column", () => {
    const r = run(F.TABLE_SIZES_DOWN_HTML);
    expect(r.chart!.rows.map((x) => x.label)).toEqual(["S", "M", "L"]);
    expect(r.chart!.rows[2]).toMatchObject({ chest: 102, waist: 88 });
  });
  it("omits sizes with open-ended values instead of inventing a bound", () => {
    const r = run(F.TABLE_OPEN_ENDED_HTML);
    expect(r.status).toBe("PARTIAL_SUCCESS");
    expect(r.chart!.rows.map((x) => x.label)).toEqual(["S", "M"]);
    expect(r.chart!.notes.join(" ")).toMatch(/open-ended/);
  });
  it("does NOT guess meaning: no statement on the page => ambiguous + needs human verification", () => {
    const r = run(F.TABLE_NO_STATEMENT_HTML);
    expect(r.status).toBe("NEEDS_HUMAN_VERIFICATION");
    expect(r.chart!.measurementType).toBe("UNKNOWN");
    expect(r.chart!.ambiguousDimensions).toEqual(["chest"]);
  });
  it("reports unavailable / invalid for pages without usable tables", () => {
    expect(run("<html><div id=app></div></html>").status).toBe("SOURCE_UNAVAILABLE");
    expect(run("<table><tr><td>Shipping</td><td>Days</td></tr><tr><td>Std</td><td>5</td></tr></table>").status).toBe("INVALID_DATA");
  });
});

describe("marketplace listing adapter (product-level)", () => {
  const t = target({ brand: "testbrand", marketplace: "flipkart", productName: "Test Brand Slim Fit Tee", url: "https://www.flipkart.com/test/p/itm1" });
  const run = (body: string) => marketplaceListingAdapter.extract({ url: new URL(t.url), body, target: t });
  it("extracts pipe-style rows, keeps inches, and reads the stated fit", () => {
    const r = run(F.LISTING_PIPE_TEXT);
    expect(r.chart!.unit).toBe("IN");
    expect(r.chart!.statedFit).toBe("SLIM");
    expect(r.chart!.rows[0]).toMatchObject({ label: "M", chest: 30, garmentLength: 25, shoulder: 14 });
  });
  it("extracts column-style tables and keeps each value on its own size (Sold Out lines ignored)", () => {
    const r = run(F.LISTING_COLUMN_TEXT);
    expect(r.chart!.rows.map((x) => [x.label, x.chest])).toEqual([["S", 90], ["M", 95], ["L", 100]]);
    expect(r.chart!.rows[1]).toMatchObject({ shoulder: 42, garmentLength: 62 });
  });
  it("refuses an incomplete row instead of shifting values onto the wrong size", () => {
    expect(run(F.LISTING_COLUMN_INCOMPLETE).status).toBe("SOURCE_UNAVAILABLE");
  });
  it("flags chest/shoulder AMBIGUOUS when the listing does not define them", () => {
    const r = run(F.LISTING_PIPE_TEXT);
    expect(r.status).toBe("NEEDS_HUMAN_VERIFICATION");
    expect(r.chart!.ambiguousDimensions.sort()).toEqual(["chest", "shoulder"]);
  });
});

describe("normalization and validation", () => {
  it("parses cells: single, range, open-ended, empty", () => {
    expect(parseCell("37.5 - 41")).toEqual({ min: 37.5, max: 41 });
    expect(parseCell("98 cm")).toEqual({ min: 98 });
    expect(parseCell("<31")).toHaveProperty("open");
    expect(parseCell("51.5+")).toHaveProperty("open");
    expect(parseCell("")).toBeNull();
  });
  it("converts inches to cm exactly once and never halves or doubles", () => {
    const r = rowsToCm([{ label: "M", chest: 40, chestMax: 42 }], "IN");
    expect(r[0]).toMatchObject({ chest: 101.6, chestMax: 106.7 });
    expect(rowsToCm([{ label: "M", chest: 101.6 }], "CM")[0].chest).toBe(101.6);
  });
  it("validation: catches duplicates, wrong units, reversed ranges, misaligned extraction", () => {
    expect(validateChart([{ label: "S", chest: 90 }, { label: "S", chest: 96 }], "CM").ok).toBe(false);
    expect(validateChart([{ label: "S", chest: 38 }, { label: "M", chest: 40 }], "CM").ok).toBe(false); // inches typed as cm
    expect(validateChart([{ label: "S", chest: 40, chestMax: 30 }, { label: "M", chest: 44 }], "IN").ok).toBe(false);
    const bad = htmlTableAdapter.extract({ url: new URL("https://www.nike.com/x"), body: F.TABLE_MISALIGNED_HTML, target: target() });
    expect(validateChart(bad.chart!.rows, bad.chart!.unit).ok).toBe(false);
    expect(validateChart([{ label: "S", chest: 90 }, { label: "M", chest: 96 }, { label: "L", chest: 102 }], "CM").ok).toBe(true);
  });
});

describe("pipeline", () => {
  it("returns every status class and fails each target independently", async () => {
    const pages: Record<string, PageResult> = {
      "https://www.nike.com/a": ok(F.TABLE_BODY_HTML),
      "https://www.nike.com/b": ok(F.TABLE_NO_STATEMENT_HTML),
      "https://www.nike.com/c": ok("<html></html>"),
      "https://www.nike.com/d": { ok: false, status: "ACCESS_RESTRICTED", httpStatus: 403, reason: "refused" },
      "https://www.nike.com/e": ok(F.TABLE_MISALIGNED_HTML),
      "https://www.nike.com/f": ok(F.TABLE_OPEN_ENDED_HTML),
    };
    const out = await runTargets(Object.keys(pages).map((url) => target({ url })), { getPage: async (u) => pages[u] });
    expect(out.map((o) => o.status)).toEqual(["SUCCESS", "NEEDS_HUMAN_VERIFICATION", "SOURCE_UNAVAILABLE", "ACCESS_RESTRICTED", "INVALID_DATA", "PARTIAL_SUCCESS"]);
    expect(out[0].rowsCm![0].chest).toBe(76.2); // 30 in
  });
  it("skips duplicate URLs in one run and unsupported domains", async () => {
    const out = await runTargets([target({ url: "https://www.nike.com/a" }), target({ url: "https://www.nike.com/a" }), target({ url: "https://unknown-site.example/x" })], { getPage: async () => ok(F.TABLE_BODY_HTML) });
    expect(out[1].reason).toMatch(/Duplicate/); expect(out[2].status).toBe("SOURCE_UNAVAILABLE");
  });
  it("is re-runnable: merging the same results twice never duplicates; changed rows update", async () => {
    const out = await runTargets([target({ url: "https://www.nike.com/a" })], { getPage: async () => ok(F.TABLE_BODY_HTML) });
    const stored = out.map(outcomeToStored).filter(Boolean) as NonNullable<ReturnType<typeof outcomeToStored>>[];
    const file: ChartsFile = { charts: [] };
    expect(mergeCharts(file, stored).added).toHaveLength(1);
    const again = mergeCharts(file, stored);
    expect(again.added).toHaveLength(0); expect(again.skipped).toHaveLength(1); expect(file.charts).toHaveLength(1);
    const changed = await runTargets([target({ url: "https://www.nike.com/a" })], { getPage: async () => ok(F.TABLE_BODY_HTML.replace("30 - 32", "31 - 33")) });
    const m = mergeCharts(file, changed.map(outcomeToStored).filter(Boolean) as never);
    expect(m.updated).toHaveLength(1); expect(file.charts).toHaveLength(1);
  });
  it("never produces VERIFIED data, and keeps marketplace + brand + product identity", async () => {
    const t = target({ brand: "testbrand", marketplace: "flipkart", productName: "Test Brand Slim Fit Tee", url: "https://www.flipkart.com/test/p/itm1" });
    const out = await runTargets([t], { getPage: async () => ({ ok: true, status: 200, body: F.LISTING_PIPE_TEXT, finalUrl: t.url }) });
    const s = outcomeToStored(out[0])!;
    expect(s.verificationStatus).toBe("UNVERIFIED");
    expect(s.sourceType).toBe("MARKETPLACE_LISTING");
    expect(s.product).toMatchObject({ brand: "testbrand", marketplace: "flipkart", name: "Test Brand Slim Fit Tee" });
    expect(s.brand).not.toBe("flipkart");
    expect(s.ambiguousDimensions!.length).toBeGreaterThan(0);
  });
  it("detects duplicate charts by content hash", () => {
    const a = chartHash({ sourceUrl: "u", gender: "MEN", region: "IN", rowsCm: [{ label: "S", chest: 90 }] });
    expect(a).toBe(chartHash({ sourceUrl: "u", gender: "MEN", region: "IN", rowsCm: [{ label: "S", chest: 90 }] }));
    expect(a).not.toBe(chartHash({ sourceUrl: "u", gender: "WOMEN", region: "IN", rowsCm: [{ label: "S", chest: 90 }] }));
  });
});

describe("csv export/import", () => {
  it("exports min/max columns in cm and re-imports to identical rows (round trip)", () => {
    const rows = [{ label: "S", chest: 88.9, chestMax: 95.3, waist: 73.7, waistMax: 81.3 }, { label: "M", chest: 95.3, chestMax: 104.1, waist: 81.3, waistMax: 88.9 }];
    const csv = rowsToCsv(rows);
    expect(csv.split("\n")[0]).toBe("size_label,chest_min_cm,chest_max_cm,waist_min_cm,waist_max_cm");
    expect(parseChartCsv(csv, "CM").rows).toEqual(rows);
  });
  it("accepts the spec format (size_label, *_cm) and per-column _in override, snake_case and garment-only columns", () => {
    const r = parseChartCsv("size_label,chest_cm,waist_in,arm_length_cm,garment_length_cm\nS,92,30,60,70\nM,98,32,62,72", "CM");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ label: "S", chest: 92, waist: 76.2, armLength: 60, garmentLength: 70 });
  });
  it("rejects duplicate records and wrong units with line numbers", () => {
    expect(parseChartCsv("size_label,chest_cm\nS,92\nS,98", "CM").errors.join()).toMatch(/duplicate/);
    expect(parseChartCsv("size_label,chest_cm\nS,36\nM,38", "CM").errors.join()).toMatch(/looks wrong/);
  });
});
