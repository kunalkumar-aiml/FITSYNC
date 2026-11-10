import type { FitPreference, Gender } from "./engine";

export type ChartCandidate = {
  id: string; gender: Gender; region: string; productLine: string; fitCut: string;
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
  charts: T[], gender: Gender, pref: FitPreference, region?: string,
): { chart: T; options: T[] } | null {
  const options = charts.filter((c) => c.gender === gender || c.gender === "UNISEX");
  if (!options.length) return null;
  const regionRank = (r: string) => (region && r === region ? 0 : r === "IN" ? 1 : r === "GLOBAL" ? 2 : 3);
  const fitRank = (f: string) => (f === pref ? 0 : FIT_ORDER.includes(f) ? 1 : 2);
  const sorted = [...options].sort((a, b) =>
    (a.gender === gender ? 0 : 1) - (b.gender === gender ? 0 : 1) ||
    regionRank(a.region) - regionRank(b.region) ||
    (regionRank(a.region) === 3 ? a.region.localeCompare(b.region) : 0) ||
    fitRank(a.fitCut) - fitRank(b.fitCut) ||
    a.productLine.localeCompare(b.productLine) || a.id.localeCompare(b.id));
  return { chart: sorted[0], options: sorted };
}

export const showDemoBrands = () => process.env.SHOW_DEMO_BRANDS === "true" || process.env.NODE_ENV !== "production";
