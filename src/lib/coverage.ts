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
