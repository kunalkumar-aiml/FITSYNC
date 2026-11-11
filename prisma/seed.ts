/**
 * Seeds categories, brands, marketplaces, REAL sourced charts (prisma/data/charts.json, incl. product-specific ones),
 * and "DATA UNAVAILABLE" notes. Nothing is invented; everything real is imported UNVERIFIED.
 * Demo (fictional) brands are only created with SEED_DEMO=true and are typed DEMO.
 * Idempotent. See prisma/lib/import.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { importCharts } from "./lib/import";

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

async function main() {
  await importCharts(db);
  if (process.env.SEED_DEMO === "true") await seedDemo();
  console.log("Seed complete.");
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
      where: { brandId_categoryId_productKey_gender_region_productLine_fitCut: { brandId: brand.id, categoryId: tshirt.id, productKey: "", gender: "UNISEX", region: "GLOBAL", productLine: "", fitCut: "REGULAR" } },
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
