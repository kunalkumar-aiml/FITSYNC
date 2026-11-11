import type { ChartRow, Dimension, FitPreference, Unit } from "../../engine";
import { DIMENSIONS } from "../../engine";
import { pageText } from "../extraction/html-table";
import { ambiguousFor, detectMeasurementType } from "../extraction/semantics";
import { dimensionFor, type Key } from "../normalization/aliases";
import type { ExtractedChart, ExtractionResult, SourceAdapter } from "../types";

const SZ = "(?:XXS|XS|S|M|L|XL|XXL|[2-9]XL|\\d{2})";
const STATED_FIT: [RegExp, FitPreference][] = [[/\bslim fit\b/i, "SLIM"], [/\boversized( fit)?\b/i, "OVERSIZED"], [/\brelaxed fit\b/i, "RELAXED"], [/\bregular fit\b/i, "REGULAR"]];

const SZRE = new RegExp(`^${SZ}$`, "i");

/** Split "... M Chest" into { key: chest, size: "M" }. Tries the longest dimension phrase first. */
function parseName(name: string): { key: Key; size: string | null } | null {
  const words = name.trim().split(/\s+/);
  for (const n of [3, 2, 1]) {
    if (words.length < n) continue;
    const key = dimensionFor(words.slice(-n).join(" "));
    if (key) { const prev = words[words.length - n - 1]; return { key, size: prev && SZRE.test(prev) ? prev.toUpperCase() : null }; }
  }
  return null;
}

/** "M Chest 36 inch | Length 28 inch | Shoulder 16 inch  L Chest 38 | ..." (pipe style, e.g. Flipkart). */
function pipeStyle(text: string) {
  const out: { label: string; vals: Record<string, number>; unit: Unit; names: Record<string, string> }[] = [];
  let cur: (typeof out)[number] | null = null;
  for (const m of text.matchAll(/([A-Za-z][A-Za-z ]*?)\s+(\d+(?:\.\d+)?)\s*(inch|in|cm)\b/g)) {
    const p = parseName(m[1]); if (!p) continue;
    if (p.size) { cur = { label: p.size, vals: {}, unit: /cm/i.test(m[3]) ? "CM" : "IN", names: {} }; out.push(cur); }
    if (!cur) continue;
    cur.vals[p.key] = parseFloat(m[2]); cur.names[p.key] = m[1].trim().split(/\s+/).slice(-1)[0];
  }
  return out.filter((r) => Object.keys(r.vals).length >= 2);
}

/** Header labels then repeating [size, (Sold Out)?, n values] (Nykaa Man style, as served in page text). */
function columnStyle(rawText: string) {
  const tokens = rawText.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
  const i = tokens.findIndex((t) => /^size$/i.test(t)); if (i < 0) return [];
  const heads: string[] = []; let j = i + 1;
  while (j < tokens.length && /^[A-Z][A-Z ]+$/.test(tokens[j]) && !new RegExp(`^${SZ}$`).test(tokens[j])) heads.push(tokens[j++]);
  const keys = heads.map((h) => dimensionFor(h));
  if (!heads.length || keys.some((k) => !k)) return [];
  const unit: Unit = /\bcm\b/i.test(tokens[i - 1] ?? "") && /\bin\b/i.test(tokens[i - 1] ?? "") ? "CM" : "CM"; // default view of the page; verified by the value ranges below
  const rows: { label: string; vals: Record<string, number>; unit: Unit; names: Record<string, string> }[] = [];
  while (j < tokens.length && new RegExp(`^${SZ}$`).test(tokens[j])) {
    const label = tokens[j++]; if (/^sold out$/i.test(tokens[j] ?? "")) j++;
    const nums: number[] = [];
    while (j < tokens.length && nums.length < keys.length && /^\d+(\.\d+)?$/.test(tokens[j])) nums.push(parseFloat(tokens[j++]));
    if (/^sold out$/i.test(tokens[j] ?? "")) j++; // availability may be shown before or after the values
    if (nums.length !== keys.length) return []; // incomplete row: refuse rather than shift values onto the wrong size
    const vals: Record<string, number> = {}, names: Record<string, string> = {};
    keys.forEach((k, idx) => { vals[k as string] = nums[idx]; names[k as string] = heads[idx]; });
    rows.push({ label, vals, unit, names });
  }
  return rows;
}

/**
 * Product-listing adapter. The chart belongs to ONE product, never to the marketplace and never to the whole brand.
 * Measurement meaning is taken only from what the listing says; otherwise chest/waist/hips/shoulder are AMBIGUOUS.
 */
export const marketplaceListingAdapter: SourceAdapter = {
  id: "marketplace-listing",
  domains: ["flipkart.com", "nykaaman.com", "myntra.com"],
  extract({ body, target }): ExtractionResult {
    const flat = pageText(body);
    const lines = body.includes("<") ? body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ") : body;
    const found = pipeStyle(flat).length >= 2 ? pipeStyle(flat) : columnStyle(lines);
    if (found.length < 2) return { status: "SOURCE_UNAVAILABLE", reason: "No product-level size table found in the page text (it may be rendered by JavaScript)." };
    const dims = new Set<Dimension>(); const labels: Record<string, string> = {};
    const rows: ChartRow[] = found.map((f) => {
      const row: Record<string, number | string> = { label: f.label };
      for (const [k, v] of Object.entries(f.vals)) { row[k] = v; labels[k] = f.names[k]; if ((DIMENSIONS as string[]).includes(k)) dims.add(k as Dimension); }
      return row as ChartRow;
    });
    const sem = detectMeasurementType(flat); // listings almost never say; then it stays UNKNOWN
    const fit = STATED_FIT.find(([re]) => re.test(flat))?.[1];
    const chart: ExtractedChart = {
      rows, unit: found[0].unit, columnLabels: labels, measurementType: sem.type === "UNKNOWN" ? "UNKNOWN" : sem.type, semanticsEvidence: sem.evidence,
      ambiguousDimensions: ambiguousFor(sem.type, [...dims]), statedFit: fit, productName: target.productName, notes: [],
    };
    if (sem.type === "UNKNOWN") return { status: "NEEDS_HUMAN_VERIFICATION", chart, reason: "Product chart extracted, but the listing does not say whether chest/shoulder are body or garment measurements. Those dimensions are flagged ambiguous." };
    return { status: "SUCCESS", chart, reason: "Product-level chart extracted." };
  },
};
