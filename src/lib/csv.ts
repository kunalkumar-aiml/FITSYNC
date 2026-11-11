import { DIMENSIONS, GARMENT_LIMITS, GARMENT_ONLY_DIMENSIONS, LIMITS, round1, toCm, type ChartRow, type Dimension, type GarmentOnlyDimension, type Unit } from "./engine";

const ALL_KEYS: (Dimension | GarmentOnlyDimension)[] = [...DIMENSIONS, ...GARMENT_ONLY_DIMENSIONS];

export type CsvResult = { rows: ChartRow[]; errors: string[]; dimensions: (Dimension | GarmentOnlyDimension)[] };

const RANGE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?)\s*$/i;
const NUM = /^\s*(\d+(?:[.,]\d+)?)\s*$/;
const num = (s: string) => parseFloat(s.replace(",", "."));

/** Minimal RFC-4180-ish line splitter: handles quoted cells containing commas. */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parse a size chart pasted/uploaded as CSV.
 *
 * Header: `label` (or `size_label`) then any of: chest, waist, hips, shoulder, armLength, inseam, neck, thigh
 * (garment-only: garmentLength, sleeveLength, rise, legOpening), optionally `<dim>_min` / `<dim>_max`, optionally with a
 * `_cm` / `_in` suffix that overrides the unit for that column (snake_case such as arm_length_min_cm also works). A cell can be a single number (35), or a range (35-37.5 or 35 to 37.5).
 * Open-ended cells (<31, 51.5+) are rejected on purpose: we never invent a missing bound.
 * Values are converted to cm using `unit`.
 */
export function parseChartCsv(text: string, unit: Unit): CsvResult {
  const errors: string[] = [];
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").map((l, i) => ({ l, n: i + 1 })).filter((x) => x.l.trim() !== "");
  if (lines.length < 3) return { rows: [], errors: ["Add a header line and at least two sizes."], dimensions: [] };

  const delim = lines[0].l.includes("\t") ? "\t" : lines[0].l.includes(";") && !lines[0].l.includes(",") ? ";" : ",";
  const header = splitLine(lines[0].l, delim).map((h) => h.trim());
  if (!["label", "size_label"].includes(header[0]?.toLowerCase())) errors.push(`Line ${lines[0].n}: the first column must be "label".`);

  type Col = { idx: number; dim: Dimension | GarmentOnlyDimension; part: "single" | "min" | "max"; unit: Unit };
  const cols: Col[] = [];
  header.slice(1).forEach((h, i) => {
    const m = /^(.*?)(?:_(min|max))?(?:_(cm|in))?$/i.exec(h);
    const key = m?.[1]?.replace(/_/g, "").toLowerCase();
    const dim = ALL_KEYS.find((d) => d.toLowerCase() === key);
    if (!m || !dim) errors.push(`Line ${lines[0].n}: unknown column "${h}". Use: ${ALL_KEYS.join(", ")} (optionally with _min/_max and _cm/_in).`);
    else cols.push({ idx: i + 1, dim, part: (m[2]?.toLowerCase() as "min" | "max" | undefined) ?? "single", unit: m[3] ? (m[3].toLowerCase() === "in" ? "IN" : "CM") : unit });
  });
  if (!cols.length && !errors.length) errors.push("No measurement columns found.");
  if (errors.length) return { rows: [], errors, dimensions: [] };

  const rows: ChartRow[] = [];
  const seen = new Set<string>();

  for (const { l, n } of lines.slice(1)) {
    const cells = splitLine(l, delim);
    const label = cells[0]?.trim();
    if (!label) { errors.push(`Line ${n}: missing size label.`); continue; }
    if (label.length > 12) errors.push(`Line ${n}: size label "${label}" is too long.`);
    if (seen.has(label.toLowerCase())) errors.push(`Line ${n}: duplicate size label "${label}".`);
    seen.add(label.toLowerCase());
    if (cells.length > header.length) errors.push(`Line ${n}: ${cells.length} cells but the header has ${header.length}.`);

    const row: Record<string, number | string> = { label };
    for (const c of cols) {
      const raw = (cells[c.idx] ?? "").trim();
      if (!raw) continue;
      let lo: number, hi: number | undefined;
      const r = RANGE.exec(raw), s = NUM.exec(raw);
      if (c.part === "single" && r) { lo = num(r[1]); hi = num(r[2]); }
      else if (s) { lo = num(s[1]); }
      else { errors.push(`Line ${n}: "${raw}" in ${c.dim} is not a number or a range (open-ended values like "<31" or "51.5+" are not accepted).`); continue; }
      if (hi !== undefined && hi < lo) { errors.push(`Line ${n}: ${c.dim} range ${raw} has min above max.`); continue; }
      const [min, max] = (LIMITS as Record<string, [number, number]>)[c.dim] ?? (GARMENT_LIMITS as Record<string, [number, number]>)[c.dim];
      const conv = (v: number) => round1(toCm(v, c.unit));
      for (const v of [lo, hi].filter((x): x is number => x !== undefined)) {
        const cm = conv(v);
        if (cm < min * 0.7 || cm > max * 1.6) errors.push(`Line ${n}: ${c.dim} ${raw} (${cm} cm) looks wrong. Check the unit.`);
      }
      if (c.part === "max") row[`${c.dim}Max`] = conv(lo);
      else { row[c.dim] = conv(lo); if (hi !== undefined) row[`${c.dim}Max`] = conv(hi); }
    }
    if (Object.keys(row).length < 2) errors.push(`Line ${n}: size ${label} has no measurements.`);
    for (const c of cols) if (c.part === "max" && row[`${c.dim}Max`] !== undefined && row[c.dim] === undefined) errors.push(`Line ${n}: ${c.dim}_max without ${c.dim}_min.`);
    rows.push(row as ChartRow);
  }
  const dimensions = [...new Set(cols.map((c) => c.dim))];
  return { rows: errors.length ? [] : rows, errors, dimensions };
}
