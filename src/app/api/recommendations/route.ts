import { ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { recommendSchema } from "@/lib/schemas";
import { runRecommendation, saveRecommendation } from "@/lib/service";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`rec:${user.id}`, 60, 60_000);
  const input = await parseBody(req, recommendSchema);
  const { loaded, result, body, fitPreference } = await runRecommendation(user.id, input.brandSlug, input.categorySlug, { fitPreference: input.fitPreference, gender: input.gender, region: input.region, productId: input.productId });
  const saved = input.save ? await saveRecommendation(user.id, loaded.version.id, fitPreference, result, body) : null;
  return ok({
    id: saved?.id ?? null,
    brand: loaded.brand, category: loaded.category, fitCut: loaded.fitCut, gender: loaded.gender, region: loaded.region, productLine: loaded.productLine, options: loaded.options, product: loaded.product, pendingProductChart: loaded.pendingProductChart, ambiguousDimensions: loaded.version.ambiguousDimensions,
    chart: { version: loaded.version.version, sourceType: loaded.version.sourceType, retrievedAt: loaded.version.retrievedAt, status: loaded.version.status, measurementType: loaded.version.measurementType, sourceUrl: loaded.version.sourceUrl, sourceNote: loaded.version.sourceNote, verifiedAt: loaded.version.verifiedAt, rows: loaded.chart.rows },
    result,
  });
});
