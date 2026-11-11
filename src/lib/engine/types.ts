export type Dimension =
  | "chest" | "waist" | "hips" | "shoulder" | "armLength" | "inseam" | "neck" | "thigh";

export const DIMENSIONS: Dimension[] = [
  "chest", "waist", "hips", "shoulder", "armLength", "inseam", "neck", "thigh",
];

/**
 * Garment-only measurements. They describe the clothing, have no matching body measurement, and are stored
 * and shown for information (and for future use) but are NOT compared with the body.
 */
export type GarmentOnlyDimension = "garmentLength" | "sleeveLength" | "rise" | "legOpening";
export const GARMENT_ONLY_DIMENSIONS: GarmentOnlyDimension[] = ["garmentLength", "sleeveLength", "rise", "legOpening"];

export type FitPreference = "SLIM" | "REGULAR" | "RELAXED" | "OVERSIZED";
export type Unit = "CM" | "IN";

/** Body measurements, always in centimetres. */
export type BodyMeasurements = Partial<Record<Dimension | "height", number>> & { weightKg?: number };

/**
 * One row of a brand chart. Values are in centimetres.
 * `chest: 92` is a single value (or the lower bound); `chestMax: 96` makes it a range 92-96.
 */
export type ChartRow = { label: string } & Partial<Record<Dimension | GarmentOnlyDimension, number>> & Partial<Record<`${Dimension}Max`, number>>;

export type Gender = "MEN" | "WOMEN" | "UNISEX";
export type AchievedFit = FitPreference | "TIGHTER_THAN_SLIM" | "LOOSER_THAN_OVERSIZED" | null;

/**
 * GARMENT: the numbers describe the finished garment (e.g. full chest circumference of the T-shirt).
 *          Ease = garment - body.
 * BODY:    the numbers describe the body the size is intended for. The brand has already built ease in.
 */
export type MeasurementType = "GARMENT" | "BODY";
export type DataStatus = "VERIFIED" | "UNVERIFIED" | "DEPRECATED";

export type ChartScope = "BRAND" | "PRODUCT";

export type SizeChart = {
  /** the garment's cut as sold, e.g. a brand's "relaxed fit" T-shirt line */
  garmentCut?: FitPreference;
  /** brand-level (default) or product-specific */
  scope?: ChartScope;
  /** dimensions whose meaning the source does not state. Never used for recommendations until resolved. */
  ambiguousDimensions?: Dimension[];
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
  /** published range for this size, when the brand gives ranges */
  chartRange?: [number, number];
  /** garment - body (cm). For ranges: distance from your body to the nearest edge (0 when you are inside the range). */
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
      /**
       * Fit Match Score (0-1). An EXPERIMENTAL heuristic: how closely this size matches your measurements for the
       * chosen fit. It is NOT a calibrated probability and has not been validated against real purchase/fit data.
       */
      fitMatchScore: number;
      /** true when the result rests on unverified data or on ignored/partial dimensions */
      provisional: boolean;
      chartScope: ChartScope;
      /** dimensions left out because their meaning is ambiguous */
      ambiguousExcluded: Dimension[];
      /** The garment's cut as sold by the brand (not your preference). */
      garmentCut: FitPreference | null;
      /** The fit this size should actually give you, judged from the primary measurement. null when it can't be known (body-measurement charts). */
      achievedFit: AchievedFit;
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
