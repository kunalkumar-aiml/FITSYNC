import type { TargetOutcome } from "./runner";
import { isUsable, semanticsFor } from "./runner";
import { chartHash } from "./csv-writer";

export type StoredChart = {
  brand: string; category: string; gender: string; region: string; productLine: string; fitCut: string; measurementType: string; unit: string;
  sourceType: string; sourceUrl: string; sourceDomain: string; extractionMethod: string; verificationStatus: string; retrievedAt: string; sourceNote: string;
  rows: Record<string, number | string>[]; columnLabels?: Record<string, string>; ambiguousDimensions?: string[]; measurementSemantics?: Record<string, string>;
  product?: { name: string; marketplace?: string; url: string; brand: string; fitCutStatedOnListing: boolean };
};
export type ChartsFile = { charts: StoredChart[]; [k: string]: unknown };

const identity = (c: Pick<StoredChart, "brand" | "category" | "gender" | "region" | "productLine" | "sourceUrl">) => [c.brand, c.category, c.gender, c.region, c.productLine, c.sourceUrl].join("|");
const rowsKey = (rows: unknown) => JSON.stringify(rows);

/** Convert a successful outcome into a charts.json entry. Always UNVERIFIED. */
export function outcomeToStored(o: TargetOutcome): StoredChart | null {
  if (!isUsable(o.status) || !o.chart) return null;
  const t = o.target, c = o.chart;
  if (c.unit === "UNKNOWN") return null; // never stored without a stated unit
  const semantics = semanticsFor(c);
  const isMarket = !!t.marketplace;
  return {
    brand: t.brand, category: t.category, gender: t.gender, region: t.region, productLine: "", fitCut: c.statedFit ?? t.fitCut ?? "UNKNOWN",
    measurementType: c.measurementType, unit: c.unit,
    sourceType: isMarket ? "MARKETPLACE_LISTING" : t.productName ? "OFFICIAL_PRODUCT_PAGE" : "OFFICIAL_SITE",
    sourceUrl: t.url, sourceDomain: new URL(t.url).host, extractionMethod: `PIPELINE:${o.adapter}`, verificationStatus: "UNVERIFIED",
    retrievedAt: o.retrievedAt.slice(0, 10), columnLabels: c.columnLabels as Record<string, string>, ambiguousDimensions: c.ambiguousDimensions, measurementSemantics: semantics,
    sourceNote: [o.reason, c.semanticsEvidence ? `Page says: "${c.semanticsEvidence}"` : "Page does not state what the measurements represent.", ...c.notes].join(" "),
    rows: c.rows as unknown as Record<string, number | string>[],
    ...(t.productName ? { product: { name: t.productName, marketplace: t.marketplace, url: t.url, brand: t.brand, fitCutStatedOnListing: !!c.statedFit } } : {}),
  };
}

/**
 * Merge new charts into charts.json without duplicating. Same source+identity and identical rows => skipped.
 * Same source+identity but different rows => the entry is updated (the DB importer then adds a NEW version).
 */
export function mergeCharts(file: ChartsFile, incoming: StoredChart[]) {
  const added: StoredChart[] = [], updated: StoredChart[] = [], skipped: StoredChart[] = [];
  for (const n of incoming) {
    const i = file.charts.findIndex((c) => identity(c) === identity(n));
    if (i < 0) { file.charts.push(n); added.push(n); }
    else if (rowsKey(file.charts[i].rows) === rowsKey(n.rows)) skipped.push(n);
    else { file.charts[i] = { ...n, verificationStatus: "UNVERIFIED" }; updated.push(n); }
  }
  return { added, updated, skipped };
}

export const storedHash = (c: StoredChart) => chartHash({ sourceUrl: c.sourceUrl, gender: c.gender, region: c.region, rowsCm: c.rows as never });
