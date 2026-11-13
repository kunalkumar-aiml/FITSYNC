import { createHash } from "node:crypto";
import { DIMENSIONS, GARMENT_ONLY_DIMENSIONS, type ChartRow } from "../../engine";

/** Stable id for "the same chart": same rows (cm) from the same source. Used to detect duplicates on re-runs. */
export function chartHash(parts: { sourceUrl: string; gender: string; region: string; rowsCm: ChartRow[] }) {
  return createHash("sha1").update(JSON.stringify([parts.sourceUrl, parts.gender, parts.region, parts.rowsCm])).digest("hex").slice(0, 16);
}

/**
 * CSV in centimetres, importable by /admin and by `parseChartCsv`:
 * size_label,chest_min_cm,chest_max_cm,...  Ranges use min/max columns; single values leave max empty.
 */
export function rowsToCsv(rowsCm: ChartRow[]): string {
  const keys = [...DIMENSIONS, ...GARMENT_ONLY_DIMENSIONS].filter((k) => rowsCm.some((r) => (r as unknown as Record<string, unknown>)[k] !== undefined));
  const cols: { key: string; head: string; get: (r: Record<string, number>) => number | undefined }[] = [];
  for (const k of keys) {
    const isRange = rowsCm.some((r) => (r as unknown as Record<string, unknown>)[`${k}Max`] !== undefined);
    const snake = k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
    if (isRange) {
      cols.push({ key: k, head: `${snake}_min_cm`, get: (r) => r[k] });
      cols.push({ key: k, head: `${snake}_max_cm`, get: (r) => r[`${k}Max`] });
    } else cols.push({ key: k, head: `${snake}_cm`, get: (r) => r[k] });
  }
  const lines = [["size_label", ...cols.map((c) => c.head)].join(",")];
  for (const row of rowsCm) {
    const r = row as unknown as Record<string, number>;
    lines.push([csvText(row.label), ...cols.map((c) => c.get(r) ?? "")].join(","));
  }
  return lines.join("\n") + "\n";
}

export const fileStem = (p: { brand: string; category: string; gender: string; region: string; product?: string; hash: string }) =>
  [p.brand, p.category, p.gender.toLowerCase(), p.region.toLowerCase(), p.product ? p.product.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) : null, p.hash].filter(Boolean).join("__");

/** Quote a text cell; neutralise spreadsheet formulas (=, +, -, @) so an extracted label can never run in Excel. */
export function csvText(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}
