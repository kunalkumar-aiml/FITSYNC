import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminClient } from "@/components/admin-client";
import { CATEGORY_CONFIGS } from "@/lib/engine";
import { getCoverage } from "@/lib/coverage";
export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageAdmin(); // server-side check; the API routes enforce it again
  const coverage = await getCoverage();
  const [users, withM, recs, fb, outcomes, brands, versions] = await Promise.all([
    db.user.count(), db.bodyMeasurement.count(), db.recommendation.count(), db.userFeedback.count(),
    db.userFeedback.groupBy({ by: ["outcome"], _count: true }),
    db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.brandSizeChartVersion.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
      include: { chart: { include: { brand: true, category: true } } },
    }),
  ]);
  const out = Object.fromEntries(outcomes.map((o) => [o.outcome, o._count]));
  const stats = [
    ["Users", users], ["With measurements", withM], ["Recommendations", recs], ["Fit reports", fb],
    ["Unverified charts", versions.filter((v) => v.status === "UNVERIFIED" && !v.chart.brand.isDemo).length],
    ["Missing brand data", coverage.reduce((n, b) => n + Object.values(b.cells).filter((c) => c.status === "UNAVAILABLE").length, 0)],
  ];
  return (
    <div className="container-x py-8 sm:py-12 max-w-4xl">
      <h1 className="text-3xl sm:text-4xl font-semibold">Admin</h1>
      <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(([k, v]) => <div key={k as string} className="card p-4"><dt className="text-xs text-muted">{k}</dt><dd className="text-2xl font-semibold tabular-nums">{v}</dd></div>)}
      </dl>
      <p className="mt-3 text-sm text-muted">Reported fit so far: {out.PERFECT ?? 0} perfect · {out.TOO_TIGHT ?? 0} too tight · {out.TOO_LOOSE ?? 0} too loose.</p>
      <div className="mt-8">
        <AdminClient coverage={coverage} brands={brands} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))}
          versions={versions.map((v) => ({ id: v.id, brand: v.chart.brand.name, category: v.chart.category.name, fitCut: v.chart.fitCut, version: v.version, gender: v.chart.gender, region: v.chart.region, productLine: v.chart.productLine, sourceType: v.sourceType, status: v.status, sourceUrl: v.sourceUrl, sourceNote: v.sourceNote, isDemo: v.chart.brand.isDemo }))} />
      </div>
    </div>
  );
}
