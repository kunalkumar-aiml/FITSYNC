import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { ProductsPanel } from "@/components/admin/catalog-panels";
import { CATEGORY_CONFIGS } from "@/lib/engine";
export const metadata = { title: "Products · Admin" };
export const dynamic = "force-dynamic";

export default async function Products() {
  await requirePageAdmin();
  const [products, brands, marketplaces] = await Promise.all([
    db.product.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { brand: true, category: true, listings: { include: { marketplace: true } }, _count: { select: { charts: true } }, coverageNotes: { take: 1, orderBy: { checkedAt: "desc" } } } }),
    db.brand.findMany({ where: { isDemo: false }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.marketplace.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { listings: true } } } }),
  ]);
  return (
    <>
      <AdminHeader title="Products and marketplaces" lede="A product always keeps its real brand. A marketplace listing is only one place the product is sold, and never owns a chart." />
      <ProductsPanel brands={brands} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))}
        marketplaces={marketplaces.map((m) => ({ slug: m.slug, name: m.name, domain: m.domain, listings: m._count.listings }))}
        products={products.map((p) => ({ id: p.id, name: p.name, brand: p.brand.name, brandSlug: p.brand.slug, category: p.category.name, gender: p.gender, fitCut: p.fitCut, fitCutStated: p.fitCutStated, charts: p._count.charts, note: p.coverageNotes[0]?.note ?? null, listings: p.listings.map((l) => ({ url: l.url, where: l.marketplace?.name ?? "Brand site" })) }))} />
    </>
  );
}
