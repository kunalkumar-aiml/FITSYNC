import { db } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const params = await ctx.params;
  const brand = await db.brand.findFirst({ where: { slug: params.slug, active: true }, include: { coverageNotes: { orderBy: { checkedAt: "desc" }, take: 1 } } });
  if (!brand) throw new ApiError(404, "Brand not found.");
  const charts = await db.brandSizeChart.findMany({
    where: { brandId: brand.id, active: true },
    include: { category: true, versions: { where: { status: { in: ["VERIFIED", "UNVERIFIED"] } }, orderBy: { version: "desc" } } },
  });
  return ok({
    brand: { slug: brand.slug, name: brand.name, region: brand.region, isDemo: brand.isDemo },
    dataUnavailableNote: brand.coverageNotes[0]?.note ?? null,
    charts: charts.filter((c) => c.versions.length).map((c) => {
      const v = c.versions.find((x) => x.status === "VERIFIED") ?? c.versions[0];
      return {
        id: c.id, category: { slug: c.category.slug, name: c.category.name }, gender: c.gender, region: c.region, productLine: c.productLine,
        fitCut: c.fitCut, version: v.version, status: v.status, measurementType: v.measurementType, sourceType: v.sourceType,
        originalUnit: v.originalUnit, rows: v.rows, sourceUrl: v.sourceUrl, sourceNote: v.sourceNote, verifiedAt: v.verifiedAt, retrievedAt: v.retrievedAt,
      };
    }),
  });
});
