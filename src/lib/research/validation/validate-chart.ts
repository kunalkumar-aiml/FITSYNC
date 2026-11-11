import { DIMENSIONS, GARMENT_LIMITS, LIMITS, round1, toCm, type ChartRow, type Dimension, type GarmentOnlyDimension, type Unit } from "../../engine";
import { GARMENT_ONLY_DIMENSIONS } from "../../engine";

export type Issue = { level: "error" | "warning"; message: string };
export type Validation = { ok: boolean; issues: Issue[] };

/** Consistency checks on a chart whose rows are in `unit`. Errors make the data INVALID; warnings need a human look. */
export function validateChart(rows: ChartRow[], unit: Unit): Validation {
  const issues: Issue[] = [];
  const err = (m: string) => issues.push({ level: "error", message: m });
  const warn = (m: string) => issues.push({ level: "warning", message: m });
  if (rows.length < 2) err("A chart needs at least two sizes.");
  const labels = rows.map((r) => r.label.toLowerCase());
  if (new Set(labels).size !== labels.length) err("Duplicate size labels.");

  const all: (Dimension | GarmentOnlyDimension)[] = [...DIMENSIONS, ...GARMENT_ONLY_DIMENSIONS];
  for (const d of all) {
    const vals = rows.map((r) => ({ label: r.label, v: r[d], max: (r as unknown as Record<string, number | undefined>)[`${d}Max`] })).filter((x) => x.v !== undefined) as { label: string; v: number; max?: number }[];
    if (!vals.length) continue;
    const [lo, hi] = (LIMITS as Record<string, [number, number]>)[d] ?? (GARMENT_LIMITS as Record<string, [number, number]>)[d];
    for (const x of vals) {
      const cm = toCm(x.v, unit), cmMax = x.max !== undefined ? toCm(x.max, unit) : cm;
      if (cm < lo * 0.7 || cmMax > hi * 1.6) err(`${d} for ${x.label} (${round1(cm)} cm) is outside any plausible range. Check the unit.`);
      if (x.max !== undefined && x.max < x.v) err(`${d} range for ${x.label} has min above max.`);
    }
    if (vals.length >= 3) {
      if (new Set(vals.map((x) => x.v)).size === 1) warn(`${d} is identical for every size.`);
      let drops = 0; for (let i = 1; i < vals.length; i++) if (vals[i].v < vals[i - 1].v) drops++;
      if (drops) warn(`${d} decreases between neighbouring sizes ${drops} time(s). Check the source.`);
      if (drops > vals.length / 3) err(`${d} is not increasing with size: the extraction is probably misaligned.`);
    }
  }
  if (!rows.some((r) => DIMENSIONS.some((d) => r[d] !== undefined))) err("No body-comparable measurement (chest, waist, hips...) found.");
  return { ok: !issues.some((i) => i.level === "error"), issues };
}
