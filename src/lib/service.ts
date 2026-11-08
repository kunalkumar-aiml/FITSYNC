import type { BodyMeasurement, Prisma } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import {
  getCategoryConfig, recommend,
  type BodyMeasurements, type FitPreference, type RecommendationResult, type SizeChart,
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
  fitCut: string;
  version: {
    id: string; version: number; status: "VERIFIED" | "UNVERIFIED" | "DEPRECATED";
    sourceUrl: string | null; sourceNote: string | null; verifiedAt: Date | null;
    measurementType: "GARMENT" | "BODY";
  };
  chart: SizeChart;
};

/** Best chart for brand+category: matching fit cut, else REGULAR, else first. Prefers latest VERIFIED version. */
export async function loadChart(brandSlug: string, categorySlug: string, pref: FitPreference): Promise<LoadedChart | null> {
  const charts = await db.brandSizeChart.findMany({
    where: { active: true, brand: { slug: brandSlug, active: true }, category: { slug: categorySlug } },
    include: {
      brand: true, category: true,
      versions: { where: { status: { not: "DEPRECATED" } }, orderBy: { version: "desc" } },
    },
  });
  const usable = charts.filter((c) => c.versions.length > 0);
  if (!usable.length) return null;
  const c = usable.find((x) => x.fitCut === pref) ?? usable.find((x) => x.fitCut === "REGULAR") ?? usable[0];
  const v = c.versions.find((x) => x.status === "VERIFIED") ?? c.versions[0];
  return {
    brand: { id: c.brand.id, slug: c.brand.slug, name: c.brand.name, isDemo: c.brand.isDemo },
    category: { slug: c.category.slug, name: c.category.name },
    fitCut: c.fitCut,
    version: {
      id: v.id, version: v.version, status: v.status, sourceUrl: v.sourceUrl, sourceNote: v.sourceNote,
      verifiedAt: v.verifiedAt, measurementType: v.measurementType as "GARMENT" | "BODY",
    },
    chart: { rows: v.rows as SizeChart["rows"], measurementType: v.measurementType as "GARMENT" | "BODY", status: v.status },
  };
}

export async function userContext(userId: string) {
  const [profile, measurement] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.bodyMeasurement.findUnique({ where: { userId } }),
  ]);
  return { profile, body: bodyFromRow(measurement), hasMeasurements: Object.keys(bodyFromRow(measurement)).length > 0 };
}

export async function runRecommendation(
  userId: string, brandSlug: string, categorySlug: string, prefOverride?: FitPreference,
) {
  const category = getCategoryConfig(categorySlug);
  if (!category) throw new ApiError(400, "Unknown clothing category.");
  const ctx = await userContext(userId);
  if (!ctx.hasMeasurements) throw new ApiError(422, "Add your body measurements first.");
  const fitPreference = (prefOverride ?? ctx.profile?.fitPreference ?? "REGULAR") as FitPreference;
  const loaded = await loadChart(brandSlug, categorySlug, fitPreference);
  if (!loaded) throw new ApiError(404, "We don't have a size chart for this brand and category yet.");
  const result: RecommendationResult = recommend({ body: ctx.body, chart: loaded.chart, category, fitPreference });
  return { loaded, result, body: ctx.body, fitPreference };
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
