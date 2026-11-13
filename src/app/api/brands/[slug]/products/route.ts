import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
export const dynamic = "force-dynamic";

// Public list of products (with their real brand and where they are listed) that have their own size chart.
export const GET = route(async (req: Request, { params }: { params: { slug: string } }) => {
  const u = new URL(req.url);
  const category = u.searchParams.get("category") ?? undefined;
  const products = await db.product.findMany({
    where: { active: true, brand: { slug: params.slug, active: true }, ...(category ? { category: undefined } : {}), charts: { some: { active: true, versions: { some: { status: { in: ["VERIFIED", "UNVERIFIED"] } } } } } },
    include: { brand: true, listings: { include: { marketplace: true } }, charts: { include: { category: true } } },
    orderBy: { name: "asc" },
  });
  return ok(products.filter((p) => !category || p.charts.some((c) => c.category.slug === category)).map((p) => ({
    id: p.id, name: p.name, brand: p.brand.name, gender: p.gender, fitCut: p.fitCut, fitCutStated: p.fitCutStated, category: p.charts[0]?.category.slug,
    listedOn: p.listings.map((l) => ({ marketplace: l.marketplace?.name ?? "Brand site", url: l.url })),
  })));
});
