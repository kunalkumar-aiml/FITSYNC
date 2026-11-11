import type { FitPreference, Gender } from "./engine";

export type ChartCandidate = {
  id: string; gender: Gender; region: string; productLine: string; fitCut: string;
  /** null/undefined = brand-level chart */
  productId?: string | null;
  /** best available status of the chart's usable version */
  status?: "VERIFIED" | "UNVERIFIED";
};

const FIT_ORDER = ["REGULAR"];

/**
 * Pick the best chart for a shopper. Pure and deterministic.
 * - Never mixes men's and women's: MEN sees MEN or UNISEX charts, WOMEN sees WOMEN or UNISEX, UNISEX sees UNISEX only.
 * - Exact gender beats UNISEX.
 * - Region: requested > IN > GLOBAL > anything else (alphabetical).
 * - Garment cut: matches the shopper's fit preference > REGULAR > anything else.
 */
export function selectChart<T extends ChartCandidate>(
  charts: T[], gender: Gender, pref: FitPreference, region?: string, productId?: string | null,
): { chart: T; options: T[] } | null {
  // A product chart is only ever considered for that exact product; other products' charts are never used.
  const options = charts.filter((c) => (c.gender === gender || c.gender === "UNISEX") && (!c.productId || c.productId === productId));
  if (!options.length) return null;
  // Evidence rank: VERIFIED product-specific > VERIFIED brand > UNVERIFIED product-specific > UNVERIFIED brand.
  // A product chart overrides the brand chart only once its own measurements are verified.
  const evidence = (c: T) => ((c.status === "VERIFIED" ? 0 : 2) + (c.productId ? 0 : 1));
  const regionRank = (r: string) => (region && r === region ? 0 : r === "IN" ? 1 : r === "GLOBAL" ? 2 : 3);
  const fitRank = (f: string) => (f === pref ? 0 : FIT_ORDER.includes(f) ? 1 : 2);
  const sorted = [...options].sort((a, b) =>
    evidence(a) - evidence(b) ||
    (a.gender === gender ? 0 : 1) - (b.gender === gender ? 0 : 1) ||
    regionRank(a.region) - regionRank(b.region) ||
    (regionRank(a.region) === 3 ? a.region.localeCompare(b.region) : 0) ||
    fitRank(a.fitCut) - fitRank(b.fitCut) ||
    a.productLine.localeCompare(b.productLine) || a.id.localeCompare(b.id));
  return { chart: sorted[0], options: sorted };
}

export const showDemoBrands = () => process.env.SHOW_DEMO_BRANDS === "true" || process.env.NODE_ENV !== "production";
