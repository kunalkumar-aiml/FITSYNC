/** Database-level test: the chart importer must be rerunnable without duplicating versions. Needs DATABASE_URL. */
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { importCharts } from "../prisma/lib/import";

const d = process.env.DATABASE_URL && process.env.TEST_SERVER_URL ? describe : describe.skip;
d("chart importer", () => {
  it("is idempotent: identical data creates no new versions, and nothing is auto-verified", async () => {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
    try {
      await importCharts(db, () => {});
      const again = await importCharts(db, () => {});
      expect(again.added).toBe(0);
      const verified = await db.brandSizeChartVersion.count({ where: { status: "VERIFIED", chart: { brand: { isDemo: false }, productId: { not: null } } } });
      expect(verified).toBe(0);
      const products = await db.product.findMany({ include: { brand: true, listings: { include: { marketplace: true } } } });
      for (const p of products) { expect(p.brand.slug).not.toMatch(/flipkart|myntra|nykaa/); expect(p.listings.length).toBeGreaterThan(0); }
    } finally { await db.$disconnect(); }
  });
});
