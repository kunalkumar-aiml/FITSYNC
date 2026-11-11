import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { CATEGORY_CONFIGS } from "../../src/lib/engine/config";
import { round1, toCm } from "../../src/lib/engine/units";

export const DATA_DIR = join(__dirname, "..", "data");
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

type Chart = {
  brand: string; category: string; gender: "MEN" | "WOMEN" | "UNISEX"; region: string; productLine: string; fitCut: string;
  measurementType: "BODY" | "GARMENT"; unit: "CM" | "IN"; sourceType: string; sourceUrl: string; sourceDomain?: string; extractionMethod?: string;
  retrievedAt?: string; sourceNote: string; rows: Record<string, number | string>[];
  ambiguousDimensions?: string[]; measurementSemantics?: Record<string, string>;
  product?: { name: string; marketplace?: string; url: string; brand: string; fitCutStatedOnListing: boolean };
};
type Data = {
  charts: Chart[]; unavailable: { brand: string; note: string }[]; researchedAt: string;
  marketplaces?: { slug: string; name: string; domain: string }[]; extraBrands?: { slug: string; name: string; region: string }[];
};

// Postgres JSONB does not preserve object key order, so compare rows with sorted keys.
const canon = (rows: unknown): string => JSON.stringify((rows as Record<string, unknown>[]).map((r) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))));

const toCmRow = (row: Record<string, number | string>, unit: "CM" | "IN") =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k === "label" ? v : round1(toCm(v as number, unit))]));

/**
 * Idempotent importer used by `npm run db:seed` and `npm run research:import`.
 * - Real charts are always imported UNVERIFIED (never auto-verified).
 * - Re-running with identical rows does nothing; changed rows create a NEW version (history preserved).
 */
export async function importCharts(db: PrismaClient, log: (m: string) => void = console.log) {
  const data: Data = JSON.parse(readFileSync(join(DATA_DIR, "charts.json"), "utf8"));
  const brands: { slug: string; name: string; region: "INTERNATIONAL" | "INDIAN" }[] = JSON.parse(readFileSync(join(DATA_DIR, "brands.json"), "utf8"));

  for (const c of CATEGORY_CONFIGS) {
    await db.clothingCategory.upsert({ where: { slug: c.slug }, create: { slug: c.slug, name: c.name, dimensions: Object.keys(c.dimensions) }, update: { name: c.name, dimensions: Object.keys(c.dimensions) } });
  }
  for (const b of [...brands, ...(data.extraBrands ?? [])] as typeof brands) {
    await db.brand.upsert({ where: { slug: b.slug }, create: { slug: b.slug, name: b.name, region: b.region }, update: {} });
  }
  for (const m of data.marketplaces ?? []) await db.marketplace.upsert({ where: { slug: m.slug }, create: m, update: { name: m.name } });

  let added = 0, unchanged = 0;
  for (const sc of data.charts) {
    const brand = await db.brand.findUniqueOrThrow({ where: { slug: sc.brand } });
    const category = await db.clothingCategory.findUniqueOrThrow({ where: { slug: sc.category } });
    let productId: string | null = null;
    if (sc.product) {
      const product = await db.product.upsert({
        where: { brandId_slug: { brandId: brand.id, slug: slugify(sc.product.name) } },
        create: { brandId: brand.id, slug: slugify(sc.product.name), name: sc.product.name, categoryId: category.id, gender: sc.gender, fitCut: sc.fitCut, fitCutStated: sc.product.fitCutStatedOnListing },
        update: {},
      });
      productId = product.id;
      const mk = sc.product.marketplace ? await db.marketplace.findUnique({ where: { slug: sc.product.marketplace } }) : null;
      await db.productListing.upsert({ where: { url: sc.product.url }, create: { productId: product.id, marketplaceId: mk?.id ?? null, url: sc.product.url, retrievedAt: sc.retrievedAt ? new Date(sc.retrievedAt) : null }, update: {} });
    }
    const chart = await db.brandSizeChart.upsert({
      where: { brandId_categoryId_productKey_gender_region_productLine_fitCut: { brandId: brand.id, categoryId: category.id, productKey: productId ?? "", gender: sc.gender, region: sc.region, productLine: sc.productLine, fitCut: sc.fitCut } },
      create: { brandId: brand.id, categoryId: category.id, productId, productKey: productId ?? "", gender: sc.gender, region: sc.region, productLine: sc.productLine, fitCut: sc.fitCut },
      update: {},
    });
    const rows = sc.rows.map((r) => toCmRow(r, sc.unit));
    const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id }, orderBy: { version: "desc" } });
    if (last && canon(last.rows) === canon(rows)) { unchanged++; continue; }
    await db.brandSizeChartVersion.create({
      data: {
        chartId: chart.id, version: (last?.version ?? 0) + 1, measurementType: sc.measurementType, sourceType: sc.sourceType as "OFFICIAL_SITE",
        originalUnit: sc.unit, retrievedAt: new Date(sc.retrievedAt ?? data.researchedAt), sourceDomain: sc.sourceDomain ?? new URL(sc.sourceUrl).host,
        extractionMethod: sc.extractionMethod ?? "UNKNOWN", measurementSemantics: (sc.measurementSemantics ?? {}) as object,
        ambiguousDimensions: (sc.ambiguousDimensions ?? []) as object,
        status: "UNVERIFIED", sourceUrl: sc.sourceUrl, sourceNote: sc.sourceNote, rows,
      },
    });
    added++;
  }

  for (const u of data.unavailable) {
    const brand = await db.brand.findUnique({ where: { slug: u.brand } });
    if (brand && !(await db.brandCoverageNote.findFirst({ where: { brandId: brand.id, note: u.note } }))) {
      await db.brandCoverageNote.create({ data: { brandId: brand.id, note: u.note, checkedAt: new Date(data.researchedAt) } });
    }
  }

  // Research ledger with a URL -> ResearchSource rows, so /admin shows what was collected or failed.
  try {
    const ledger: { url?: string; status: string; method: string; reason: string; date: string }[] = JSON.parse(readFileSync(join(DATA_DIR, "research", "reports", "source-log.json"), "utf8"));
    for (const l of ledger) {
      if (!l.url || l.status === "NOT_APPLICABLE") continue;
      const status = l.status as "SUCCESS";
      if (!(await db.researchSource.findFirst({ where: { url: l.url, status, note: l.reason } }))) {
        await db.researchSource.create({ data: { url: l.url, domain: new URL(l.url).host, status, extractionMethod: l.method, note: l.reason, retrievedAt: new Date(l.date) } });
      }
    }
  } catch { /* ledger is optional */ }

  log(`Charts: ${added} new version(s), ${unchanged} unchanged. All imported charts are UNVERIFIED until verified in /admin.`);
  return { added, unchanged };
}
