import { CATEGORY_CONFIGS, type ChartRow, type Unit } from "../../engine";
import { validateChart } from "../validation/validate-chart";
import type { StoredChart } from "./merge";

export type LedgerEntry = { brand: string; target: string; method: string; status: string; date: string; reason: string; url?: string };
export type Brand = { slug: string; name: string };

const GENDERS = ["MEN", "WOMEN"] as const;
const OK = ["SUCCESS", "PARTIAL_SUCCESS", "NEEDS_HUMAN_VERIFICATION"];

export function buildReports(charts: StoredChart[], ledger: LedgerEntry[], brands: Brand[], marketplaces: string[]) {
  const brandLevel = charts.filter((c) => !c.product);
  const productLevel = charts.filter((c) => c.product);
  const usable = (c: StoredChart) => !(c.ambiguousDimensions ?? []).length;

  const coverage = brands.map((b) => ({
    brand: b.slug, name: b.name,
    cells: CATEGORY_CONFIGS.flatMap((cat) => GENDERS.map((g) => {
      const m = brandLevel.filter((c) => c.brand === b.slug && c.category === cat.slug && (c.gender === g || c.gender === "UNISEX"));
      return { category: cat.slug, gender: g, status: m.length ? (m.every((c) => c.verificationStatus === "VERIFIED") ? "VERIFIED" : "UNVERIFIED") : "MISSING", regions: [...new Set(m.map((c) => c.region))] };
    })),
    productSpecificCharts: productLevel.filter((c) => c.brand === b.slug).length,
  }));

  const missing = coverage.flatMap((b) => b.cells.filter((c) => c.status === "MISSING").map((c) => ({ brand: b.brand, category: c.category, gender: c.gender })));
  const failed = ledger.filter((l) => !OK.includes(l.status) && l.status !== "NOT_APPLICABLE");
  const attention = ledger.filter((l) => l.status === "NEEDS_HUMAN_VERIFICATION");

  const quality = charts.map((c) => {
    const v = validateChart(c.rows as unknown as ChartRow[], c.unit as Unit);
    return {
      brand: c.brand, category: c.category, gender: c.gender, region: c.region, product: c.product?.name ?? null, sourceUrl: c.sourceUrl,
      sizes: c.rows.length, measurementType: c.measurementType, ambiguousDimensions: c.ambiguousDimensions ?? [], usableForRecommendations: usable(c),
      verification: c.verificationStatus, validationOk: v.ok, issues: v.issues,
    };
  });

  const manifest = charts.map((c) => ({
    brand: c.brand, product: c.product?.name ?? null, marketplace: c.product?.marketplace ?? null, category: c.category, gender: c.gender, region: c.region,
    sourceType: c.sourceType, sourceUrl: c.sourceUrl, sourceDomain: c.sourceDomain, extractionMethod: c.extractionMethod, retrievedAt: c.retrievedAt, verification: c.verificationStatus,
  }));

  const summary = {
    brandsTargeted: brands.length,
    brandsWithAnyChart: new Set(charts.map((c) => c.brand)).size,
    brandsWithBrandLevelCharts: new Set(brandLevel.map((c) => c.brand)).size,
    charts: charts.length, brandLevelCharts: brandLevel.length, productSpecificCharts: productLevel.length,
    verifiedCharts: charts.filter((c) => c.verificationStatus === "VERIFIED").length,
    unverifiedCharts: charts.filter((c) => c.verificationStatus !== "VERIFIED").length,
    chartsWithAmbiguousDimensions: charts.filter((c) => (c.ambiguousDimensions ?? []).length).length,
    chartsUsableForRecommendations: charts.filter(usable).length,
    categoriesWithData: [...new Set(charts.map((c) => c.category))],
    categoriesSupportedByEngine: CATEGORY_CONFIGS.map((c) => c.slug),
    marketplacesStudied: marketplaces,
    sourcesAttempted: ledger.length, sourcesFailed: failed.length, needsHumanVerification: attention.length,
  };
  return { summary, coverage, missing, failed, quality, manifest };
}

export function toMarkdown(r: ReturnType<typeof buildReports>) {
  const s = r.summary;
  const cov = ["| Brand | " + CATEGORY_CONFIGS.map((c) => c.slug).join(" | ") + " |", "|---|" + CATEGORY_CONFIGS.map(() => "---").join("|") + "|"];
  for (const b of r.coverage) cov.push(`| ${b.name} | ` + CATEGORY_CONFIGS.map((c) => b.cells.filter((x) => x.category === c.slug).map((x) => `${x.gender[0]}:${x.status === "MISSING" ? "–" : x.status === "VERIFIED" ? "V" : "U"}`).join(" ")).join(" | ") + " |");
  return {
    coverage: `# Brand coverage\nV = verified, U = unverified, – = missing (DATA UNAVAILABLE). M = men's, W = women's.\n\n${cov.join("\n")}\n`,
    missing: `# Missing data\n${r.missing.length} brand/category/gender combinations have no chart.\n\n` + r.missing.map((m) => `- ${m.brand} / ${m.category} / ${m.gender}`).join("\n") + "\n",
    failed: `# Failed or incomplete research\n\n` + r.failed.map((f) => `- **${f.brand}** · ${f.target} · \`${f.status}\` (${f.date})${f.url ? `\n  - ${f.url}` : ""}\n  - ${f.reason}`).join("\n") + "\n",
    quality: `# Data quality\n\n- Charts: ${s.charts} (brand-level ${s.brandLevelCharts}, product-specific ${s.productSpecificCharts})\n- Verified: ${s.verifiedCharts} · Unverified: ${s.unverifiedCharts}\n- Charts with ambiguous measurements (excluded from recommendations): ${s.chartsWithAmbiguousDimensions}\n- Usable for recommendations today: ${s.chartsUsableForRecommendations}\n\n` +
      r.quality.map((q) => `- ${q.brand}${q.product ? ` · ${q.product}` : ""} · ${q.category} · ${q.gender} · ${q.region}: ${q.sizes} sizes, ${q.measurementType}, ${q.verification}, validation ${q.validationOk ? "ok" : "FAILED"}${q.ambiguousDimensions.length ? `, ambiguous: ${q.ambiguousDimensions.join("/")}` : ""}${q.issues.length ? ` — ${q.issues.map((i) => i.message).join("; ")}` : ""}`).join("\n") + "\n",
  };
}
