export type Dimension =
  | "chest" | "waist" | "hips" | "shoulder" | "armLength" | "inseam" | "neck" | "thigh";

export const DIMENSIONS: Dimension[] = [
  "chest", "waist", "hips", "shoulder", "armLength", "inseam", "neck", "thigh",
];

export type FitPreference = "SLIM" | "REGULAR" | "RELAXED" | "OVERSIZED";
export type Unit = "CM" | "IN";

/** Body measurements, always in centimetres. */
export type BodyMeasurements = Partial<Record<Dimension | "height", number>> & { weightKg?: number };

/** One row of a brand chart. Values are in centimetres. */
export type ChartRow = { label: string } & Partial<Record<Dimension, number>>;

/**
 * GARMENT: the numbers describe the finished garment (e.g. full chest circumference of the T-shirt).
 *          Ease = garment - body.
 * BODY:    the numbers describe the body the size is intended for. The brand has already built ease in.
 */
export type MeasurementType = "GARMENT" | "BODY";
export type DataStatus = "VERIFIED" | "UNVERIFIED" | "DEPRECATED";

export type SizeChart = {
  rows: ChartRow[];
  measurementType: MeasurementType;
  status: DataStatus;
};

export type EaseRange = { min: number; max: number };

export type DimensionRule = {
  weight: number;
  /** cm of deviation outside the ideal range at which the score for that dimension reaches 0 */
  tolerance: number;
  /** Ideal garment ease (garment - body) per fit preference. Used for GARMENT charts. */
  ease: Record<FitPreference, EaseRange>;
  /** If true, this dimension must be present for a recommendation to be made. */
  required?: boolean;
};

export type CategoryConfig = {
  slug: string;
  name: string;
  dimensions: Partial<Record<Dimension, DimensionRule>>;
};

export type FitLabel = "Tight" | "Slightly Tight" | "Good" | "Slightly Loose" | "Loose";

export type DimensionResult = {
  dimension: Dimension;
  bodyCm: number;
  chartCm: number;
  /** garment - body (cm) */
  differenceCm: number;
  idealRange: EaseRange;
  label: FitLabel;
  score: number;
};

export type SizeScore = {
  label: string;
  score: number;
  coverage: number;
  dimensions: DimensionResult[];
  skipped: Dimension[];
};

export type RecommendationResult =
  | {
      status: "ok";
      recommendedSize: string;
      fitPreference: FitPreference;
      confidence: number;
      compatibility: Partial<Record<Dimension, FitLabel>>;
      alternatives: { size: string; score: number }[];
      ranking: SizeScore[];
      explanation: string;
      warnings: string[];
      dataStatus: DataStatus;
    }
  | {
      status: "no_compatible_size";
      fitPreference: FitPreference;
      closest?: { size: string; score: number };
      ranking: SizeScore[];
      explanation: string;
      warnings: string[];
      dataStatus: DataStatus;
    }
  | {
      status: "insufficient_data";
      missing: Dimension[];
      explanation: string;
      warnings: string[];
      dataStatus: DataStatus;
    }
  | {
      status: "invalid_input";
      errors: string[];
      explanation: string;
    };
