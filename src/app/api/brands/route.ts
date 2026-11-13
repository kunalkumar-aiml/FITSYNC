import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { showDemoBrands } from "@/lib/chart-select";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brands = await db.brand.findMany({
    where: { active: true, ...(showDemoBrands() ? {} : { isDemo: false }) },
    orderBy: { name: "asc" },
    include: {
      coverageNotes: { orderBy: { checkedAt: "desc" }, take: 1 },
      sizeCharts: {
        where: { active: true },
        include: { category: { select: { slug: true, name: true } }, versions: { where: { status: { in: ["VERIFIED", "UNVERIFIED"] } }, select: { status: true } } },
      },
    },
  });
  return ok(brands.map((b) => ({
    slug: b.slug, name: b.name, region: b.region, isDemo: b.isDemo,
    dataUnavailableNote: b.sizeCharts.some((c) => c.versions.length) ? null : b.coverageNotes[0]?.note ?? null,
    charts: b.sizeCharts.filter((c) => c.versions.length).map((c) => ({
      category: c.category.slug, categoryName: c.category.name, gender: c.gender, region: c.region, productLine: c.productLine,
      status: c.versions.some((v) => v.status === "VERIFIED") ? "VERIFIED" : "UNVERIFIED",
    })),
  })));
});
