import { db } from "./db";
import { ApiError } from "./api";
import type { ChartRow } from "./engine";
import type { z } from "zod";
import type { chartVersionSchema } from "./schemas";

type Input = Omit<z.infer<typeof chartVersionSchema>, "rows"> & {
  rows: ChartRow[]; productId?: string; extractionMethod?: string; measurementSemantics?: Record<string, string>; sourceDomain?: string;
  /** pipeline results that a person must look at start as NEEDS_HUMAN_VERIFICATION */
  status?: "UNVERIFIED" | "NEEDS_HUMAN_VERIFICATION";
};

// Postgres JSONB does not preserve key order, so rows are compared with sorted keys.
export const canonRows = (rows: unknown): string =>
  JSON.stringify(((rows as Record<string, unknown>[]) ?? []).map((r) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))));

/**
 * Create a NEW version of a chart (history is never overwritten). Rows must already be in cm.
 * Duplicate detection: if the latest non-deprecated version of the same chart already has identical rows and meaning,
 * nothing is created and that version is returned with duplicate: true.
 */
export async function createChartVersion(input: Input) {
  const [brand, category] = await Promise.all([
    db.brand.findUnique({ where: { slug: input.brandSlug } }),
    db.clothingCategory.findUnique({ where: { slug: input.categorySlug } }),
  ]);
  if (!brand) throw new ApiError(404, "Brand not found.");
  if (!category) throw new ApiError(404, "Category not found.");
  if (input.productId) {
    const p = await db.product.findUnique({ where: { id: input.productId } });
    if (!p || p.brandId !== brand.id) throw new ApiError(400, "That product does not belong to this brand.");
  }
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
  const latest = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id, status: { notIn: ["DEPRECATED", "INVALID"] } }, orderBy: { version: "desc" } });
  if (latest && canonRows(latest.rows) === canonRows(input.rows) && latest.measurementType === input.measurementType
      && JSON.stringify(latest.ambiguousDimensions ?? []) === JSON.stringify(input.ambiguousDimensions ?? [])) {
    return { ...latest, duplicate: true as const };
  }
  const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id }, orderBy: { version: "desc" } });
  const created = await db.brandSizeChartVersion.create({
    data: {
      chartId: chart.id, version: (last?.version ?? 0) + 1, rows: input.rows as unknown as object, measurementType: input.measurementType,
      sourceType: input.sourceType, originalUnit: input.originalUnit, retrievedAt: new Date(),
      sourceDomain: input.sourceDomain ?? (input.sourceUrl ? new URL(input.sourceUrl).host : null), extractionMethod: input.extractionMethod ?? "ADMIN_ENTRY",
      measurementSemantics: (input.measurementSemantics ?? {}) as object, ambiguousDimensions: (input.ambiguousDimensions ?? []) as object,
      status: input.status ?? "UNVERIFIED", sourceUrl: input.sourceUrl, sourceNote: input.sourceNote,
    },
  });
  return { ...created, duplicate: false as const };
}
