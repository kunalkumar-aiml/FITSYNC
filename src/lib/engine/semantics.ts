import type { Dimension, DimensionSemantic, ExcludedDimension, SizeChart } from "./types";

/** Map stored codes (MeasurementDefinition.code and older values) to the engine's semantic. Unknown codes are AMBIGUOUS. */
export function normalizeSemanticCode(code: string | undefined | null): DimensionSemantic | undefined {
  if (!code) return undefined;
  switch (code) {
    case "BODY": case "BODY_CIRCUMFERENCE": case "BODY_LINEAR": return "BODY";
    case "GARMENT": case "GARMENT_CIRCUMFERENCE": case "GARMENT_LINEAR": return "GARMENT";
    case "GARMENT_WIDTH_FLAT": case "GARMENT_FLAT": return "GARMENT_FLAT";
    default: return "AMBIGUOUS";
  }
}

/** Parse a stored measurementSemantics JSON object into per-dimension semantics. */
export function parseSemantics(json: unknown): Partial<Record<Dimension, DimensionSemantic>> {
  const out: Partial<Record<Dimension, DimensionSemantic>> = {};
  if (json && typeof json === "object" && !Array.isArray(json)) {
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      const s = normalizeSemanticCode(typeof v === "string" ? v : null);
      if (s) out[k as Dimension] = s;
    }
  }
  return out;
}

/**
 * The meaning of one dimension of a chart. Order: explicit per-dimension semantics > flagged ambiguous >
 * chart-level type. A chart-level UNKNOWN or MIXED type gives AMBIGUOUS, never GARMENT.
 */
export function semanticFor(chart: Pick<SizeChart, "semantics" | "ambiguousDimensions" | "measurementType">, d: Dimension): DimensionSemantic {
  if (chart.ambiguousDimensions?.includes(d)) return "AMBIGUOUS";
  const explicit = chart.semantics?.[d];
  if (explicit) return explicit;
  if (chart.measurementType === "BODY") return "BODY";
  if (chart.measurementType === "GARMENT") return "GARMENT";
  return "AMBIGUOUS";
}

export function excludedReason(s: DimensionSemantic): ExcludedDimension["reason"] | null {
  return s === "AMBIGUOUS" ? "AMBIGUOUS" : s === "GARMENT_FLAT" ? "FLAT_WIDTH" : null;
}
