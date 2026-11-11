import { db } from "./db";
import { createChartVersion } from "./chart-admin";
import { runTargets, isUsable, type TargetOutcome } from "./research/ingestion/runner";
import type { Target } from "./research/types";
import type { Prisma } from "@prisma/client";

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

async function ensureProduct(t: Target) {
  const brand = await db.brand.findUnique({ where: { slug: t.brand } });
  const category = await db.clothingCategory.findUnique({ where: { slug: t.category } });
  if (!brand || !category || !t.productName) return null;
  const product = await db.product.upsert({
    where: { brandId_slug: { brandId: brand.id, slug: slugify(t.productName) } },
    create: { brandId: brand.id, slug: slugify(t.productName), name: t.productName, categoryId: category.id, gender: t.gender, fitCut: t.fitCut ?? "REGULAR" }, update: {},
  });
  const mk = t.marketplace ? await db.marketplace.findUnique({ where: { slug: t.marketplace } }) : null;
  await db.productListing.upsert({ where: { url: t.url }, create: { productId: product.id, marketplaceId: mk?.id ?? null, url: t.url, retrievedAt: new Date() }, update: { retrievedAt: new Date() } });
  return product;
}

async function saveOutcome(jobId: string, o: TargetOutcome) {
  let chartVersionId: string | null = null;
  if (isUsable(o.status) && o.chart && o.rowsCm) {
    const product = await ensureProduct(o.target);
    const sourceType = o.target.marketplace ? "MARKETPLACE_LISTING" : o.target.productName ? "OFFICIAL_PRODUCT_PAGE" : "OFFICIAL_SITE";
    const semantics: Record<string, string> = {};
    for (const k of Object.keys(o.chart.columnLabels)) semantics[k] = o.chart.ambiguousDimensions.includes(k as never) ? "AMBIGUOUS" : o.chart.measurementType === "BODY" ? "BODY_CIRCUMFERENCE" : "GARMENT_CIRCUMFERENCE";
    const v = await createChartVersion({
      brandSlug: o.target.brand, categorySlug: o.target.category, gender: o.target.gender, region: o.target.region, productLine: "",
      fitCut: o.chart.statedFit ?? o.target.fitCut ?? "REGULAR", measurementType: o.chart.measurementType === "UNKNOWN" ? "GARMENT" : o.chart.measurementType,
      sourceType, originalUnit: o.chart.unit, rows: o.rowsCm, sourceUrl: o.target.url, sourceNote: o.reason + (o.chart.semanticsEvidence ? ` Page says: "${o.chart.semanticsEvidence}"` : " The page does not state what the measurements represent."),
      ambiguousDimensions: o.chart.ambiguousDimensions as never, productId: product?.id, extractionMethod: `PIPELINE:${o.adapter}`, measurementSemantics: semantics,
    } as Parameters<typeof createChartVersion>[0]);
    chartVersionId = v.id;
  }
  await db.researchSource.create({
    data: { jobId, url: o.target.url, domain: new URL(o.target.url).host, status: o.status, httpStatus: o.httpStatus ?? null, extractionMethod: o.adapter ? `PIPELINE:${o.adapter}` : null, note: o.reason, chartVersionId },
  });
}

/** Run (or re-run) a job inline. Bounded by the caller (max targets); every target fails independently. */
export async function runJob(jobId: string, only?: Target[]) {
  const job = await db.researchJob.findUniqueOrThrow({ where: { id: jobId } });
  const targets = only ?? (job.targets as unknown as Target[]);
  await db.researchJob.update({ where: { id: jobId }, data: { state: "RUNNING", startedAt: new Date() } });
  try {
    const outcomes = await runTargets(targets);
    for (const o of outcomes) await saveOutcome(jobId, o);
    const counts: Record<string, number> = {};
    for (const o of outcomes) counts[o.status] = (counts[o.status] ?? 0) + 1;
    await db.researchJob.update({ where: { id: jobId }, data: { state: "COMPLETED", finishedAt: new Date(), summary: { counts, total: outcomes.length } as Prisma.InputJsonValue } });
    return outcomes;
  } catch (e) {
    console.error("[research] job failed", jobId, e);
    await db.researchJob.update({ where: { id: jobId }, data: { state: "FAILED", finishedAt: new Date(), summary: { error: "Job failed. See server logs." } } });
    throw e;
  }
}
