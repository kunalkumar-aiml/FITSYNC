/**
 * Seeds categories and the brand list.
 *
 * REAL BRAND SIZE CHARTS ARE NOT INCLUDED. FITSYNC never invents official sizing data.
 * Add real charts through /admin (with a source URL or note), then mark them Verified.
 *
 * Three clearly-labelled DEMO brands with made-up numbers are seeded so the app is usable in
 * development and for demos. They are flagged isDemo=true and UNVERIFIED, and the UI says so.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CATEGORY_CONFIGS } from "../src/lib/engine/config";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const REAL_BRANDS: [string, string, "INTERNATIONAL" | "INDIAN"][] = [
  ["zara", "Zara", "INTERNATIONAL"], ["hm", "H&M", "INTERNATIONAL"], ["uniqlo", "Uniqlo", "INTERNATIONAL"],
  ["levis", "Levi's", "INTERNATIONAL"], ["nike", "Nike", "INTERNATIONAL"], ["adidas", "Adidas", "INTERNATIONAL"],
  ["puma", "Puma", "INTERNATIONAL"], ["bewakoof", "Bewakoof", "INDIAN"], ["snitch", "Snitch", "INDIAN"],
  ["the-souled-store", "The Souled Store", "INDIAN"], ["max-fashion", "Max Fashion", "INDIAN"], ["westside", "Westside", "INDIAN"],
];

// DEMO DATA — fictional numbers for development only.
const DEMO = [
  { slug: "demo-brand-a", name: "Demo Brand A (sample data)", tshirt: [["S", 96, 42, 94], ["M", 102, 44, 100], ["L", 108, 46, 106], ["XL", 114, 48, 112]] },
  { slug: "demo-brand-b", name: "Demo Brand B (sample data)", tshirt: [["S", 100, 43, 98], ["M", 106, 45, 104], ["L", 112, 47, 110], ["XL", 118, 49, 116]] },
  { slug: "demo-brand-c", name: "Demo Brand C (sample data)", tshirt: [["S", 92, 41, 90], ["M", 98, 43, 96], ["L", 104, 45, 102], ["XL", 110, 47, 108]] },
] as const;

async function main() {
  for (const c of CATEGORY_CONFIGS) {
    await db.clothingCategory.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, dimensions: Object.keys(c.dimensions) },
      update: { name: c.name, dimensions: Object.keys(c.dimensions) },
    });
  }
  for (const [slug, name, region] of REAL_BRANDS) {
    await db.brand.upsert({ where: { slug }, create: { slug, name, region }, update: {} });
  }
  const tshirt = await db.clothingCategory.findUniqueOrThrow({ where: { slug: "tshirt" } });
  for (const d of DEMO) {
    const brand = await db.brand.upsert({
      where: { slug: d.slug }, create: { slug: d.slug, name: d.name, region: "INTERNATIONAL", isDemo: true }, update: {},
    });
    const chart = await db.brandSizeChart.upsert({
      where: { brandId_categoryId_fitCut: { brandId: brand.id, categoryId: tshirt.id, fitCut: "REGULAR" } },
      create: { brandId: brand.id, categoryId: tshirt.id, fitCut: "REGULAR" }, update: {},
    });
    const exists = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id } });
    if (!exists) {
      await db.brandSizeChartVersion.create({
        data: {
          chartId: chart.id, version: 1, measurementType: "GARMENT", status: "UNVERIFIED",
          sourceNote: "FITSYNC demo data. Fictional numbers, not a real brand's size chart.",
          rows: d.tshirt.map(([label, chest, shoulder, waist]) => ({ label, chest, shoulder, waist })),
        },
      });
    }
  }
  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
