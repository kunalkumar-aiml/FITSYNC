import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { BrandsPanel } from "@/components/admin/catalog-panels";
import { CATEGORY_CONFIGS } from "@/lib/engine";
export const metadata = { title: "Brands · Admin" };
export const dynamic = "force-dynamic";

export default async function Brands() {
  await requirePageAdmin();
  const brands = await db.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, sizeCharts: true } }, coverageNotes: { where: { productId: null }, orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  return (
    <>
      <AdminHeader title="Brands" lede="Clothing brands only. Marketplaces (Myntra, Flipkart, Nykaa) are managed under Products, because they sell brands rather than being one." />
      <BrandsPanel categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))}
        brands={brands.map((b) => ({ slug: b.slug, name: b.name, region: b.region, active: b.active, isDemo: b.isDemo, products: b._count.products, charts: b._count.sizeCharts, note: b.coverageNotes[0]?.note ?? null }))} />
    </>
  );
}
