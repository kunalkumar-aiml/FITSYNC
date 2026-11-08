import { db } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { compareSchema } from "@/lib/schemas";
import { getCategoryConfig, recommend, type FitPreference } from "@/lib/engine";
import { loadChart, userContext } from "@/lib/service";
import { ApiError } from "@/lib/api";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, compareSchema);
  const category = getCategoryConfig(input.categorySlug);
  if (!category) throw new ApiError(400, "Unknown clothing category.");
  const ctx = await userContext(user.id);
  if (!ctx.hasMeasurements) throw new ApiError(422, "Add your body measurements first.");
  const pref = (input.fitPreference ?? ctx.profile?.fitPreference ?? "REGULAR") as FitPreference;

  const brands = await db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { slug: true } });
  const rows = [];
  for (const b of brands) {
    const loaded = await loadChart(b.slug, category.slug, pref);
    if (!loaded) continue;
    const result = recommend({ body: ctx.body, chart: loaded.chart, category, fitPreference: pref });
    rows.push({ brand: loaded.brand, status: result.status, dataStatus: loaded.version.status, result });
  }
  return ok({ category: { slug: category.slug, name: category.name }, fitPreference: pref, rows });
});
