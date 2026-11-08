import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const [users, withMeasurements, recommendations, feedback, outcomes, unverified, brands] = await Promise.all([
    db.user.count(),
    db.bodyMeasurement.count(),
    db.recommendation.count(),
    db.userFeedback.count(),
    db.userFeedback.groupBy({ by: ["outcome"], _count: true }),
    db.brandSizeChartVersion.count({ where: { status: "UNVERIFIED" } }),
    db.brand.count({ where: { active: true } }),
  ]);
  return ok({
    users, withMeasurements, recommendations, feedback, brands, unverifiedChartVersions: unverified,
    outcomes: Object.fromEntries(outcomes.map((o) => [o.outcome, o._count])),
  });
});
