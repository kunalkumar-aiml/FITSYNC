import { db } from "./db";
import { ApiError } from "./api";
import type { ChartRow } from "./engine";
import type { z } from "zod";
import type { chartVersionSchema } from "./schemas";

type Input = Omit<z.infer<typeof chartVersionSchema>, "rows"> & { rows: ChartRow[]; productId?: string; extractionMethod?: string; measurementSemantics?: Record<string, string>; sourceDomain?: string };

/** Create a NEW unverified version of a chart (history is never overwritten). Rows must already be in cm. */
export async function createChartVersion(input: Input) {
  const [brand, category] = await Promise.all([
    db.brand.findUnique({ where: { slug: input.brandSlug } }),
    db.clothingCategory.findUnique({ where: { slug: input.categorySlug } }),
  ]);
  if (!brand) throw new ApiError(404, "Brand not found.");
  if (!category) throw new ApiError(404, "Category not found.");
  const labels = input.rows.map((r) => r.label.toLowerCase());
  if (new Set(labels).size !== labels.length) throw new ApiError(400, "Size labels must be unique.");
  if (!input.sourceUrl && !input.sourceNote) throw new ApiError(400, "Record where this chart came from (source URL or note).");
  if (["OFFICIAL_SITE", "OFFICIAL_PRODUCT_PAGE", "MARKETPLACE_LISTING"].includes(input.sourceType) && !input.sourceUrl) throw new ApiError(400, "This source type needs its source URL.");

  const chart = await db.brandSizeChart.upsert({
    where: { brandId_categoryId_productKey_gender_region_productLine_fitCut: {
      brandId: brand.id, categoryId: category.id, productKey: input.productId ?? "", gender: input.gender, region: input.region, productLine: input.productLine, fitCut: input.fitCut,
    } },
    create: { brandId: brand.id, categoryId: category.id, productId: input.productId ?? null, productKey: input.productId ?? "", gender: input.gender, region: input.region, productLine: input.productLine, fitCut: input.fitCut },
    update: { active: true },
  });
  const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id }, orderBy: { version: "desc" } });
  return db.brandSizeChartVersion.create({
    data: {
      chartId: chart.id, version: (last?.version ?? 0) + 1, rows: input.rows as unknown as object, measurementType: input.measurementType,
      sourceType: input.sourceType, originalUnit: input.originalUnit, retrievedAt: new Date(),
      sourceDomain: input.sourceDomain ?? (input.sourceUrl ? new URL(input.sourceUrl).host : null), extractionMethod: input.extractionMethod ?? "ADMIN_ENTRY",
      measurementSemantics: (input.measurementSemantics ?? {}) as object, ambiguousDimensions: (input.ambiguousDimensions ?? []) as object,
      status: "UNVERIFIED", sourceUrl: input.sourceUrl, sourceNote: input.sourceNote,
    },
  });
}
