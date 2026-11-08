import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brands = await db.brand.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      sizeCharts: {
        where: { active: true },
        include: { category: { select: { slug: true, name: true } }, versions: { where: { status: { not: "DEPRECATED" } }, select: { status: true } } },
      },
    },
  });
  return ok(brands.map((b) => ({
    slug: b.slug, name: b.name, region: b.region, isDemo: b.isDemo,
    categories: b.sizeCharts.filter((c) => c.versions.length).map((c) => ({
      slug: c.category.slug, name: c.category.name,
      status: c.versions.some((v) => v.status === "VERIFIED") ? "VERIFIED" : "UNVERIFIED",
    })),
  })));
});
