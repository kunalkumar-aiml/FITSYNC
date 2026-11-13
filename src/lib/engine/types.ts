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
 * Chart-level default meaning of the published numbers:
 * GARMENT: the finished garment (e.g. full chest circumference of the T-shirt). Ease = garment - body.
 * BODY:    the body the size is intended for. The brand has already built ease in.
 * UNKNOWN: the source does not say. Never silently treated as GARMENT: every dimension is AMBIGUOUS unless a person
 *          has stated its meaning in `semantics`.
 * MIXED:   different dimensions mean different things; `semantics` says which.
 */
export type MeasurementType = "GARMENT" | "BODY" | "UNKNOWN" | "MIXED";
export type DataStatus = "VERIFIED" | "UNVERIFIED" | "DEPRECATED" | "NEEDS_HUMAN_VERIFICATION" | "INVALID";

/**
 * What ONE published dimension means. Dimension-specific, because a chart can give body chest but garment length.
 * BODY:         a body measurement (circumference for chest/waist/hips/thigh/neck; straight line for shoulder/arm/inseam).
 * GARMENT:      the same measurement taken on the garment (full circumference, seam-to-seam width, inside-leg length).
 * GARMENT_FLAT: a garment width measured laid flat (half the circumference). NOT comparable with a body circumference
 *               and never doubled by the engine; an admin can convert it explicitly, which is recorded.
 * AMBIGUOUS:    the source does not say. Excluded.
 */
export type DimensionSemantic = "BODY" | "GARMENT" | "GARMENT_FLAT" | "AMBIGUOUS";

/** Cut of the garment as sold. UNKNOWN when the source does not state it (never assumed to be REGULAR). */
export type GarmentCut = FitPreference | "UNKNOWN";

export type ChartScope = "BRAND" | "PRODUCT";

export type SizeChart = {
  /** the garment's cut as sold, e.g. a brand's "relaxed fit" T-shirt line. UNKNOWN = not stated by the source. */
  garmentCut?: GarmentCut;
  /** per-dimension meaning; wins over measurementType */
  semantics?: Partial<Record<Dimension, DimensionSemantic>>;
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

export type ExcludedDimension = { dimension: Dimension; reason: "AMBIGUOUS" | "FLAT_WIDTH" };

export type FitLabel = "Tight" | "Slightly Tight" | "Good" | "Slightly Loose" | "Loose";

export type DimensionResult = {
  dimension: Dimension;
  /** what the chart value for this dimension describes */
  semantic: "BODY" | "GARMENT";
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
      /** every dimension that was not compared, with the reason */
      excluded: ExcludedDimension[];
      /** The garment's cut as sold by the brand (not your preference). null when the source does not state it. */
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
      excluded?: ExcludedDimension[];
      explanation: string;
      warnings: string[];
      dataStatus: DataStatus;
    }
  | {
      status: "invalid_input";
      errors: string[];
      explanation: string;
    };
