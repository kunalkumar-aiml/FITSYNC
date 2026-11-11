import type { ChartRow, Dimension, FitPreference, Gender, Unit } from "../engine";

export type ResearchStatus =
  | "SUCCESS" | "PARTIAL_SUCCESS" | "SOURCE_UNAVAILABLE" | "ACCESS_RESTRICTED" | "INVALID_DATA" | "NEEDS_HUMAN_VERIFICATION";

export type Semantic = "BODY_CIRCUMFERENCE" | "GARMENT_CIRCUMFERENCE" | "GARMENT_WIDTH_FLAT" | "GARMENT_LENGTH" | "AMBIGUOUS";

export type Target = {
  brand: string;            // brand slug
  category: string;
  gender: Gender;
  region: string;
  url: string;
  productName?: string;     // set for product-level charts
  marketplace?: string;     // marketplace slug when the URL is a marketplace listing
  fitCut?: FitPreference;
};

/** Rows in the SOURCE's own unit, exactly as published (ranges as x / xMax). Nothing is halved or doubled. */
export type ExtractedChart = {
  rows: ChartRow[];
  unit: Unit;
  /** which published column label each dimension came from, e.g. { chest: "Bust" } */
  columnLabels: Partial<Record<string, string>>;
  measurementType: "BODY" | "GARMENT" | "UNKNOWN";
  /** why we believe measurementType (quoted from the page); empty when unknown */
  semanticsEvidence: string | null;
  /** dimensions whose meaning is NOT stated by the source */
  ambiguousDimensions: Dimension[];
  statedFit?: FitPreference;
  productName?: string;
  notes: string[];
};

export type ExtractionResult = { status: ResearchStatus; chart?: ExtractedChart; reason: string };

export interface SourceAdapter {
  id: string;
  /** hostnames (exact or suffix) this adapter is allowed to handle */
  domains: string[];
  extract(input: { url: URL; body: string; target: Target }): ExtractionResult;
}

export type PageResult =
  | { ok: true; status: number; body: string; finalUrl: string }
  | { ok: false; status: ResearchStatus; httpStatus?: number; reason: string };
