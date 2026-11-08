import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { RecommendClient } from "@/components/recommend-client";
import { CATEGORY_CONFIGS } from "@/lib/engine";
export const metadata = { title: "Find your size" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { brand?: string; category?: string } }) {
  const user = await requirePageUser();
  const [m, profile, brands] = await Promise.all([
    db.bodyMeasurement.findUnique({ where: { userId: user.id } }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.brand.findMany({
      where: { active: true }, orderBy: { name: "asc" },
      include: { sizeCharts: { where: { active: true }, include: { category: true, versions: { where: { status: { not: "DEPRECATED" } }, select: { id: true } } } } },
    }),
  ]);
  if (!m) {
    return (
      <div className="container-x py-16 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Add your measurements first</h1>
        <p className="mt-2 text-muted">We need at least your chest or waist to recommend a size.</p>
        <Link href="/profile?welcome=1" className="btn btn-primary mt-6">Create fit profile</Link>
      </div>
    );
  }
  const opts = brands.map((b) => ({
    slug: b.slug, name: b.name, isDemo: b.isDemo,
    categories: b.sizeCharts.filter((c) => c.versions.length).map((c) => ({ slug: c.category.slug, name: c.category.name })),
  })).filter((b) => b.categories.length);
  return (
    <RecommendClient brands={opts} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))}
      defaultFit={profile?.fitPreference ?? "REGULAR"} initialBrand={searchParams.brand} initialCategory={searchParams.category} />
  );
}
