import { db } from "./db";
import { CATEGORY_CONFIGS } from "./engine";

export type CoverageCell = { status: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE"; charts: number };
const GENDERS = ["MEN", "WOMEN"] as const;

/** brand x category x gender: what data exists, what is unverified, and what is missing. */
export async function getCoverage(includeDemo = false) {
  const brands = await db.brand.findMany({
    where: { active: true, ...(includeDemo ? {} : { isDemo: false }) }, orderBy: { name: "asc" },
    include: {
      coverageNotes: { orderBy: { checkedAt: "desc" }, take: 1 },
      sizeCharts: { where: { active: true }, include: { category: true, versions: { where: { status: { not: "DEPRECATED" } }, select: { status: true } } } },
    },
  });
  return brands.map((b) => {
    const cells: Record<string, CoverageCell> = {};
    for (const c of CATEGORY_CONFIGS) for (const g of GENDERS) {
      const charts = b.sizeCharts.filter((x) => x.category.slug === c.slug && (x.gender === g || x.gender === "UNISEX") && x.versions.length);
      const verified = charts.some((x) => x.versions.some((v) => v.status === "VERIFIED"));
      cells[`${c.slug}:${g}`] = { status: !charts.length ? "UNAVAILABLE" : verified ? "VERIFIED" : "UNVERIFIED", charts: charts.length };
    }
    return { slug: b.slug, name: b.name, region: b.region, note: b.coverageNotes[0]?.note ?? null, cells };
  });
}

export type CoverageRow = {
  brand: string; brandName: string; category: string; gender: "MEN" | "WOMEN"; region: string; product: string | null;
  status: "Verified" | "Unverified" | "Missing" | "Outdated" | "Product-specific"; ambiguous: boolean; lastUpdated: string | null;
};
const OUTDATED_DAYS = 365;

/** Flat brand x category x gender (x region / product) rows for the admin coverage table. */
export async function getCoverageRows(): Promise<CoverageRow[]> {
  const brands = await db.brand.findMany({
    where: { active: true, isDemo: false }, orderBy: { name: "asc" },
    include: { sizeCharts: { where: { active: true }, include: { category: true, product: true, versions: { where: { status: { not: "DEPRECATED" } }, orderBy: { version: "desc" } } } } },
  });
  const rows: CoverageRow[] = [];
  for (const b of brands) for (const c of CATEGORY_CONFIGS) for (const g of GENDERS) {
    const charts = b.sizeCharts.filter((x) => x.category.slug === c.slug && (x.gender === g || x.gender === "UNISEX") && x.versions.length);
    if (!charts.length) { rows.push({ brand: b.slug, brandName: b.name, category: c.slug, gender: g, region: "-", product: null, status: "Missing", ambiguous: false, lastUpdated: null }); continue; }
    for (const ch of charts) {
      const v = ch.versions.find((x) => x.status === "VERIFIED") ?? ch.versions[0];
      const when = (v.verifiedAt ?? v.retrievedAt ?? v.createdAt);
      const old = Date.now() - when.getTime() > OUTDATED_DAYS * 86_400_000;
      const amb = Array.isArray(v.ambiguousDimensions) && v.ambiguousDimensions.length > 0;
      rows.push({
        brand: b.slug, brandName: b.name, category: c.slug, gender: g, region: ch.region, product: ch.product?.name ?? null,
        status: ch.productId ? "Product-specific" : v.status === "VERIFIED" ? (old ? "Outdated" : "Verified") : old ? "Outdated" : "Unverified",
        ambiguous: amb, lastUpdated: when.toISOString().slice(0, 10),
      });
    }
  }
  return rows;
}
