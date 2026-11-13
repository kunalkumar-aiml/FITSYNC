import { db } from "@/lib/db";
import { showDemoBrands } from "@/lib/chart-select";
import { CATEGORY_CONFIGS } from "@/lib/engine";
import { BrandExplorer, type ExplorerBrand } from "@/components/brand-explorer";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Brand explorer" };
export const dynamic = "force-dynamic";

export default async function Brands() {
  const brands = await db.brand.findMany({
    where: { active: true, ...(showDemoBrands() ? {} : { isDemo: false }) }, orderBy: { name: "asc" },
    include: {
      coverageNotes: { orderBy: { checkedAt: "desc" }, take: 1, select: { note: true } },
      sizeCharts: { where: { active: true }, include: { category: { select: { slug: true, name: true } }, versions: { where: { status: { in: ["VERIFIED", "UNVERIFIED"] } }, select: { status: true } } } },
    },
  });
  const data: ExplorerBrand[] = brands.map((b) => {
    const charts = b.sizeCharts.filter((c) => c.versions.length).map((c) => ({
      category: c.category.slug, categoryName: c.category.name, gender: c.gender, region: c.region, product: !!c.productId,
      verified: c.versions.some((v) => v.status === "VERIFIED"),
    }));
    return { slug: b.slug, name: b.name, region: b.region, isDemo: b.isDemo, note: b.coverageNotes[0]?.note ?? null, charts };
  });
  return (
    <div className="container-x">
      <PageHeader title="Brand explorer" lede={<>Every chart shows its source. Where no usable official chart exists, the brand says <strong className="text-ink font-medium">Data unavailable</strong>, and we don’t guess one.</>} />
      <BrandExplorer brands={data} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))} />
    </div>
  );
}
