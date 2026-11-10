import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { compareSchema } from "@/lib/schemas";
import { getCategoryConfig, recommend, type FitPreference, type Gender } from "@/lib/engine";
import { loadChart, userContext, GENDERS } from "@/lib/service";
import { showDemoBrands } from "@/lib/chart-select";
export const dynamic = "force-dynamic";

// Every brand is calculated from its own chart. Brands without usable data are returned separately as
// `unavailable` (with the reason), never with an invented size.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, compareSchema);
  const category = getCategoryConfig(input.categorySlug);
  if (!category) throw new ApiError(400, "Unknown clothing category.");
  const ctx = await userContext(user.id);
  if (!ctx.hasMeasurements) throw new ApiError(422, "Add your body measurements first.");
  const pref = (input.fitPreference ?? ctx.profile?.fitPreference ?? "REGULAR") as FitPreference;
  const gender = (input.gender ?? ctx.profile?.fitCategory) as Gender | null | undefined;
  if (!gender || !GENDERS.includes(gender)) throw new ApiError(422, "Choose men's, women's or unisex sizing first.", { code: "GENDER_REQUIRED" });

  const brands = await db.brand.findMany({
    where: { active: true, ...(showDemoBrands() ? {} : { isDemo: false }) }, orderBy: { name: "asc" }, select: { slug: true, name: true, isDemo: true },
  });
  const rows = [];
  const unavailable = [];
  for (const b of brands) {
    const loaded = await loadChart(b.slug, category.slug, gender, pref, input.region);
    if ("available" in loaded) { unavailable.push({ brand: b, reason: loaded.reason, note: loaded.note }); continue; }
    const result = recommend({ body: ctx.body, chart: loaded.chart, category, fitPreference: pref });
    rows.push({ brand: loaded.brand, status: result.status, dataStatus: loaded.version.status, region: loaded.region, productLine: loaded.productLine, measurementType: loaded.version.measurementType, result });
  }
  return ok({ category: { slug: category.slug, name: category.name }, fitPreference: pref, gender, rows, unavailable });
});
