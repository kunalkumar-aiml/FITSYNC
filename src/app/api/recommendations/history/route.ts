import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db.recommendation.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    include: {
      chartVersion: { include: { chart: { include: { brand: true, category: true } } } },
      feedback: { select: { id: true, purchasedSize: true, outcome: true } },
    },
  });
  return ok(rows.map((r) => ({
    id: r.id, createdAt: r.createdAt, brand: r.chartVersion.chart.brand.name, brandSlug: r.chartVersion.chart.brand.slug,
    isDemo: r.chartVersion.chart.brand.isDemo,
    category: r.chartVersion.chart.category.name, fitPreference: r.fitPreference,
    recommendedSize: r.recommendedSize, confidence: r.confidence, insufficientData: r.insufficientData,
    dataStatus: r.chartVersion.status, feedback: r.feedback[0] ?? null,
  })));
});
