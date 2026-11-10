/**
 * Seeds categories, the brand list, REAL sourced size charts (prisma/data/charts.json) and
 * "DATA UNAVAILABLE" notes for brands where no official table could be retrieved.
 *
 * RULES
 * - Real charts are copied only from official brand pages (sourceUrl recorded per chart).
 * - They are seeded as UNVERIFIED. A human must open the source URL, compare, and click Verify in /admin.
 * - Nothing is invented. Fictional DEMO brands are only created when SEED_DEMO=true, and are kept separate.
 * - Idempotent: safe to run many times. A chart version is only added if that source has no version yet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CATEGORY_CONFIGS } from "../src/lib/engine/config";
import { round1, toCm } from "../src/lib/engine/units";

// tsx does not read .env by itself, so load DATABASE_URL from it when it is not already set.
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(join(__dirname, "..", ".env"), "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* no .env file */ }
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const REAL_BRANDS: [string, string, "INTERNATIONAL" | "INDIAN"][] = [
  ["zara", "Zara", "INTERNATIONAL"], ["hm", "H&M", "INTERNATIONAL"], ["uniqlo", "Uniqlo", "INTERNATIONAL"],
  ["levis", "Levi's", "INTERNATIONAL"], ["nike", "Nike", "INTERNATIONAL"], ["adidas", "Adidas", "INTERNATIONAL"],
  ["puma", "Puma", "INTERNATIONAL"], ["bewakoof", "Bewakoof", "INDIAN"], ["snitch", "Snitch", "INDIAN"],
  ["the-souled-store", "The Souled Store", "INDIAN"], ["max-fashion", "Max Fashion", "INDIAN"], ["westside", "Westside", "INDIAN"],
];

type SourceChart = {
  brand: string; category: string; gender: "MEN" | "WOMEN" | "UNISEX"; region: string; productLine: string; fitCut: string;
  measurementType: "BODY" | "GARMENT"; unit: "CM" | "IN"; sourceType: string; sourceUrl: string; sourceNote: string;
  rows: Record<string, number | string>[];
};
type Data = { charts: SourceChart[]; unavailable: { brand: string; note: string }[]; researchedAt: string };

const toCmRow = (row: Record<string, number | string>, unit: "CM" | "IN") =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k === "label" ? v : round1(toCm(v as number, unit))]));

async function main() {
  const data: Data = JSON.parse(readFileSync(join(__dirname, "data", "charts.json"), "utf8"));

  for (const c of CATEGORY_CONFIGS) {
    await db.clothingCategory.upsert({
      where: { slug: c.slug }, create: { slug: c.slug, name: c.name, dimensions: Object.keys(c.dimensions) },
      update: { name: c.name, dimensions: Object.keys(c.dimensions) },
    });
  }
  for (const [slug, name, region] of REAL_BRANDS) {
    await db.brand.upsert({ where: { slug }, create: { slug, name, region }, update: {} });
  }

  let added = 0;
  for (const sc of data.charts) {
    const brand = await db.brand.findUniqueOrThrow({ where: { slug: sc.brand } });
    const category = await db.clothingCategory.findUniqueOrThrow({ where: { slug: sc.category } });
    const chart = await db.brandSizeChart.upsert({
      where: { brandId_categoryId_gender_region_productLine_fitCut: {
        brandId: brand.id, categoryId: category.id, gender: sc.gender, region: sc.region, productLine: sc.productLine, fitCut: sc.fitCut } },
      create: { brandId: brand.id, categoryId: category.id, gender: sc.gender, region: sc.region, productLine: sc.productLine, fitCut: sc.fitCut },
      update: {},
    });
    const exists = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id, sourceUrl: sc.sourceUrl } });
    if (exists) continue;
    const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id }, orderBy: { version: "desc" } });
    await db.brandSizeChartVersion.create({
      data: {
        chartId: chart.id, version: (last?.version ?? 0) + 1, measurementType: sc.measurementType,
        sourceType: sc.sourceType as "OFFICIAL_SITE", originalUnit: sc.unit, retrievedAt: new Date(data.researchedAt),
        status: "UNVERIFIED", // never auto-verified
        sourceUrl: sc.sourceUrl, sourceNote: sc.sourceNote, rows: sc.rows.map((r) => toCmRow(r, sc.unit)),
      },
    });
    added++;
  }

  // DATA UNAVAILABLE records (brand-level; they apply to every category/gender without a chart)
  for (const u of data.unavailable) {
    const brand = await db.brand.findUnique({ where: { slug: u.brand } });
    if (!brand) continue;
    const same = await db.brandCoverageNote.findFirst({ where: { brandId: brand.id, note: u.note } });
    if (!same) await db.brandCoverageNote.create({ data: { brandId: brand.id, note: u.note, checkedAt: new Date(data.researchedAt) } });
  }

  if (process.env.SEED_DEMO === "true") await seedDemo();
  console.log(`Seed complete. ${added} new chart version(s). Charts are UNVERIFIED until verified in /admin.`);
}

// Fictional numbers, development only. Flagged isDemo and typed DEMO so they are never confused with real data.
async function seedDemo() {
  const DEMO = [
    { slug: "demo-brand-a", name: "Demo Brand A (sample data)", rows: [["S", 96, 42, 94], ["M", 102, 44, 100], ["L", 108, 46, 106], ["XL", 114, 48, 112]] },
    { slug: "demo-brand-b", name: "Demo Brand B (sample data)", rows: [["S", 100, 43, 98], ["M", 106, 45, 104], ["L", 112, 47, 110], ["XL", 118, 49, 116]] },
    { slug: "demo-brand-c", name: "Demo Brand C (sample data)", rows: [["S", 92, 41, 90], ["M", 98, 43, 96], ["L", 104, 45, 102], ["XL", 110, 47, 108]] },
  ] as const;
  const tshirt = await db.clothingCategory.findUniqueOrThrow({ where: { slug: "tshirt" } });
  for (const d of DEMO) {
    const brand = await db.brand.upsert({ where: { slug: d.slug }, create: { slug: d.slug, name: d.name, region: "INTERNATIONAL", isDemo: true }, update: {} });
    const chart = await db.brandSizeChart.upsert({
      where: { brandId_categoryId_gender_region_productLine_fitCut: { brandId: brand.id, categoryId: tshirt.id, gender: "UNISEX", region: "GLOBAL", productLine: "", fitCut: "REGULAR" } },
      create: { brandId: brand.id, categoryId: tshirt.id }, update: {},
    });
    if (!(await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id } }))) {
      await db.brandSizeChartVersion.create({
        data: { chartId: chart.id, version: 1, measurementType: "GARMENT", status: "UNVERIFIED", sourceType: "DEMO",
          sourceNote: "FITSYNC demo data. Fictional numbers, not a real brand's size chart.",
          rows: d.rows.map(([label, chest, shoulder, waist]) => ({ label, chest, shoulder, waist })) },
      });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
