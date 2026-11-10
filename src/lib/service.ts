import type { BodyMeasurement, Prisma } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { selectChart } from "./chart-select";
import {
  getCategoryConfig, recommend,
  type BodyMeasurements, type FitPreference, type Gender, type RecommendationResult, type SizeChart,
} from "./engine";

export function bodyFromRow(m: BodyMeasurement | null): BodyMeasurements {
  if (!m) return {};
  const pairs: [keyof BodyMeasurements, number | null][] = [
    ["height", m.heightCm], ["weightKg", m.weightKg], ["chest", m.chestCm], ["waist", m.waistCm],
    ["hips", m.hipsCm], ["shoulder", m.shoulderCm], ["armLength", m.armLengthCm],
    ["inseam", m.inseamCm], ["neck", m.neckCm], ["thigh", m.thighCm],
  ];
  const out: Record<string, number> = {};
  for (const [k, v] of pairs) if (v !== null && v !== undefined) out[k as string] = v;
  return out as BodyMeasurements;
}

export type LoadedChart = {
  brand: { id: string; slug: string; name: string; isDemo: boolean };
  category: { slug: string; name: string };
  gender: Gender;
  region: string;
  productLine: string;
  fitCut: string;
  version: {
    id: string; version: number; status: "VERIFIED" | "UNVERIFIED" | "DEPRECATED";
    sourceUrl: string | null; sourceNote: string | null; sourceType: string; verifiedAt: Date | null; retrievedAt: Date | null;
    measurementType: "GARMENT" | "BODY";
  };
  chart: SizeChart;
  /** other charts this shopper could use for the same brand/category (other regions or product lines) */
  options: { region: string; productLine: string; gender: Gender }[];
};

export type Availability = { available: false; reason: "NO_CHART" | "NO_CHART_FOR_GENDER"; note: string | null };

/** Best chart for brand + category + gender. Returns why it is unavailable instead of guessing. */
export async function loadChart(
  brandSlug: string, categorySlug: string, gender: Gender, pref: FitPreference, region?: string,
): Promise<LoadedChart | Availability> {
  const brand = await db.brand.findFirst({ where: { slug: brandSlug, active: true } });
  const charts = await db.brandSizeChart.findMany({
    where: { active: true, brandId: brand?.id ?? "none", category: { slug: categorySlug } },
    include: {
      brand: true, category: true,
      versions: { where: { status: { not: "DEPRECATED" } }, orderBy: { version: "desc" } },
    },
  });
  const usable = charts.filter((c) => c.versions.length > 0);
  const cat = await db.clothingCategory.findUnique({ where: { slug: categorySlug } });
  const note = brand
    ? (await db.brandCoverageNote.findFirst({
        where: { brandId: brand.id, OR: [{ categoryId: null }, { categoryId: cat?.id ?? "none" }], AND: [{ OR: [{ gender: null }, { gender }] }] },
        orderBy: { checkedAt: "desc" },
      }))?.note ?? null
    : null;
  if (!usable.length) return { available: false, reason: "NO_CHART", note };
  const pick = selectChart(usable.map((c) => ({ ...c, gender: c.gender as Gender })), gender, pref, region);
  if (!pick) return { available: false, reason: "NO_CHART_FOR_GENDER", note };
  const c = pick.chart;
  const v = c.versions.find((x) => x.status === "VERIFIED") ?? c.versions[0];
  return {
    brand: { id: c.brand.id, slug: c.brand.slug, name: c.brand.name, isDemo: c.brand.isDemo },
    category: { slug: c.category.slug, name: c.category.name },
    gender: c.gender as Gender, region: c.region, productLine: c.productLine, fitCut: c.fitCut,
    version: {
      id: v.id, version: v.version, status: v.status, sourceUrl: v.sourceUrl, sourceNote: v.sourceNote,
      sourceType: v.sourceType, verifiedAt: v.verifiedAt, retrievedAt: v.retrievedAt,
      measurementType: v.measurementType as "GARMENT" | "BODY",
    },
    chart: {
      rows: v.rows as SizeChart["rows"], measurementType: v.measurementType as "GARMENT" | "BODY", status: v.status,
      garmentCut: c.fitCut as FitPreference,
    },
    options: pick.options.map((o) => ({ region: o.region, productLine: o.productLine, gender: o.gender })),
  };
}

export async function userContext(userId: string) {
  const [profile, measurement] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.bodyMeasurement.findUnique({ where: { userId } }),
  ]);
  return { profile, body: bodyFromRow(measurement), hasMeasurements: Object.keys(bodyFromRow(measurement)).length > 0 };
}

export const GENDERS = ["MEN", "WOMEN", "UNISEX"] as const;

export async function runRecommendation(
  userId: string, brandSlug: string, categorySlug: string,
  opts: { fitPreference?: FitPreference; gender?: Gender; region?: string } = {},
) {
  const category = getCategoryConfig(categorySlug);
  if (!category) throw new ApiError(400, "Unknown clothing category.");
  const ctx = await userContext(userId);
  if (!ctx.hasMeasurements) throw new ApiError(422, "Add your body measurements first.");
  const fitPreference = (opts.fitPreference ?? ctx.profile?.fitPreference ?? "REGULAR") as FitPreference;
  const gender = (opts.gender ?? ctx.profile?.fitCategory) as Gender | null | undefined;
  if (!gender || !GENDERS.includes(gender)) throw new ApiError(422, "Choose men's, women's or unisex sizing first.", { code: "GENDER_REQUIRED" });
  const loaded = await loadChart(brandSlug, categorySlug, gender, fitPreference, opts.region);
  if ("available" in loaded) {
    throw new ApiError(404, loaded.note ?? "We don't have a size chart for this brand, category and sizing type yet.", { code: "DATA_UNAVAILABLE", reason: loaded.reason });
  }
  const result: RecommendationResult = recommend({ body: ctx.body, chart: loaded.chart, category, fitPreference });
  return { loaded, result, body: ctx.body, fitPreference, gender };
}

export async function saveRecommendation(
  userId: string, chartVersionId: string, fitPreference: FitPreference, result: RecommendationResult, body: BodyMeasurements,
) {
  return db.recommendation.create({
    data: {
      userId, chartVersionId, fitPreference,
      recommendedSize: result.status === "ok" ? result.recommendedSize : null,
      confidence: result.status === "ok" ? result.confidence : null,
      insufficientData: result.status === "insufficient_data",
      result: result as unknown as Prisma.InputJsonValue,
      inputSnapshot: body as unknown as Prisma.InputJsonValue,
    },
  });
}
