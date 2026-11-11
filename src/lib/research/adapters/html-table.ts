import type { ChartRow, Dimension, Unit } from "../../engine";
import { extractTables, pageText } from "../extraction/html-table";
import { parseCell } from "../extraction/cells";
import { ambiguousFor, detectMeasurementType } from "../extraction/semantics";
import { dimensionFor, unitFromLabel, type Key } from "../normalization/aliases";
import type { ExtractedChart, ExtractionResult, SourceAdapter } from "../types";
import { DIMENSIONS } from "../../engine";

const SIZE = /^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|\d{1,2}(\.\d)?|\d{2}\/\d{2}|[smlx]{1,4})$/i;
const looksLikeSizes = (cells: string[]) => cells.length >= 2 && cells.filter((c) => SIZE.test(c.trim())).length >= Math.ceil(cells.length * 0.7);

/**
 * Generic adapter for official size-guide pages that publish a plain HTML <table> (e.g. nike.com size & fit pages).
 * Handles both layouts: sizes across the top, or sizes down the left. Not tied to any one site's markup.
 */
export const htmlTableAdapter: SourceAdapter = {
  id: "html-table",
  domains: ["nike.com", "adidas.co.in", "adidas.com", "puma.com", "uniqlo.com", "hm.com", "zara.com", "levi.com", "levi.in", "bewakoof.com", "snitch.com", "thesouledstore.com", "maxfashion.in", "westside.com", "savana.com"],
  extract({ body, target }): ExtractionResult {
    const tables = extractTables(body);
    if (!tables.length) return { status: "SOURCE_UNAVAILABLE", reason: "No HTML table found. The page may be rendered by JavaScript." };
    const text = pageText(body);
    const sem = detectMeasurementType(text);
    const notes: string[] = [];
    let best: { chart: ExtractedChart; score: number } | null = null;

    for (const table of tables) {
      const transposed = looksLikeSizes(table[0].slice(1)); // sizes across the header row
      const grid = transposed ? table : table[0].map((_, c) => table.map((r) => r[c] ?? "")); // normalise: first row = sizes
      if (!transposed && !looksLikeSizes(table.slice(1).map((r) => r[0] ?? ""))) continue;
      const sizes = grid[0].slice(1).map((s) => s.trim());
      const rows: ChartRow[] = sizes.map((label) => ({ label }) as ChartRow);
      const labels: Record<string, string> = {}; let unit: Unit | null = null; const dims = new Set<Dimension>(); const dropped = new Set<string>();
      for (const line of grid.slice(1)) {
        const key: Key | null = dimensionFor(line[0]);
        if (!key) continue;
        unit = unit ?? unitFromLabel(line[0]);
        labels[key] = line[0].replace(/\(.*?\)/g, "").trim();
        line.slice(1).forEach((raw, i) => {
          const cell = parseCell(raw);
          if (!cell) return;
          if ("open" in cell) { dropped.add(sizes[i]); notes.push(`Size ${sizes[i]}: open-ended value "${cell.open}" for ${key} - size omitted (no bound was published).`); return; }
          (rows[i] as unknown as Record<string, number>)[key] = cell.min;
          if (cell.max !== undefined && (DIMENSIONS as string[]).includes(key)) (rows[i] as unknown as Record<string, number>)[`${key}Max`] = cell.max;
          if ((DIMENSIONS as string[]).includes(key)) dims.add(key as Dimension);
        });
      }
      const kept = rows.filter((r) => !dropped.has(r.label) && Object.keys(r).length > 1);
      if (!dims.size || kept.length < 2) continue;
      const chart: ExtractedChart = {
        rows: kept, unit: unit ?? "CM", columnLabels: labels, measurementType: sem.type, semanticsEvidence: sem.evidence,
        ambiguousDimensions: ambiguousFor(sem.type, [...dims]), notes: [...notes], productName: target.productName,
      };
      if (!best || dims.size * kept.length > best.score) best = { chart, score: dims.size * kept.length };
    }
    if (!best) return { status: "INVALID_DATA", reason: "Tables found but none looked like a size chart (no size labels + recognised measurements)." };
    const c = best.chart;
    if (c.measurementType === "UNKNOWN") return { status: "NEEDS_HUMAN_VERIFICATION", chart: c, reason: "Chart extracted, but the page does not say whether it lists body or garment measurements." };
    if (c.notes.length) return { status: "PARTIAL_SUCCESS", chart: c, reason: "Chart extracted; some sizes were omitted because their values were open-ended." };
    return { status: "SUCCESS", chart: c, reason: "Chart extracted from an HTML table." };
  },
};
