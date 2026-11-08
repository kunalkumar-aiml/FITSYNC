import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { chartVersionSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

// Creates a NEW unverified version (history is never overwritten). Verify it with PUT /size-charts/:versionId.
export const POST = route(async (req: Request) => {
  await requireAdmin();
  const input = await parseBody(req, chartVersionSchema);
  const [brand, category] = await Promise.all([
    db.brand.findUnique({ where: { slug: input.brandSlug } }),
    db.clothingCategory.findUnique({ where: { slug: input.categorySlug } }),
  ]);
  if (!brand) throw new ApiError(404, "Brand not found.");
  if (!category) throw new ApiError(404, "Category not found.");
  const labels = input.rows.map((r) => r.label.toLowerCase());
  if (new Set(labels).size !== labels.length) throw new ApiError(400, "Size labels must be unique.");

  const chart = await db.brandSizeChart.upsert({
    where: { brandId_categoryId_fitCut: { brandId: brand.id, categoryId: category.id, fitCut: input.fitCut } },
    create: { brandId: brand.id, categoryId: category.id, fitCut: input.fitCut }, update: { active: true },
  });
  const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: chart.id }, orderBy: { version: "desc" } });
  const version = await db.brandSizeChartVersion.create({
    data: {
      chartId: chart.id, version: (last?.version ?? 0) + 1, rows: input.rows, measurementType: input.measurementType,
      status: "UNVERIFIED", sourceUrl: input.sourceUrl, sourceNote: input.sourceNote,
    },
  });
  return ok(version, 201);
});
