import { BODY_CHART_OFFSET, MIN_ACCEPTABLE_SCORE, UNVERIFIED_CONFIDENCE_CAP } from "./config";
import { validateBody } from "./validate";
import type {
  BodyMeasurements, CategoryConfig, ChartRow, Dimension, DimensionResult, DimensionRule,
  AchievedFit, EaseRange, FitLabel, FitPreference, RecommendationResult, SizeChart, SizeScore,
} from "./types";

export type RecommendInput = {
  body: BodyMeasurements;
  chart: SizeChart;
  category: CategoryConfig;
  fitPreference: FitPreference;
};

const TIGHT_PENALTY = 1.25; // being too tight is worse than being too loose
const IN_RANGE_FLOOR = 0.9; // lowest score a dimension can get while inside the ideal range edge

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => (n > 0 ? `+${round1(n)}` : `${round1(n)}`);

export function scoreDimension(
  dimension: Dimension, bodyCm: number, chartCm: number, rule: DimensionRule, range: EaseRange,
): DimensionResult {
  const diff = chartCm - bodyCm;
  let deviation = 0;
  let side: "tight" | "loose" | "none" = "none";
  if (diff < range.min) { deviation = range.min - diff; side = "tight"; }
  else if (diff > range.max) { deviation = diff - range.max; side = "loose"; }

  let score: number;
  if (side === "none") {
    const half = (range.max - range.min) / 2;
    const mid = (range.max + range.min) / 2;
    const centering = half > 0 ? Math.min(1, Math.abs(diff - mid) / half) : 0;
    score = 1 - (1 - IN_RANGE_FLOOR) * centering;
  } else {
    const eff = side === "tight" ? deviation * TIGHT_PENALTY : deviation;
    score = IN_RANGE_FLOOR * Math.max(0, 1 - eff / rule.tolerance);
  }

  let label: FitLabel = "Good";
  if (side !== "none") {
    const slight = deviation <= rule.tolerance * 0.4;
    label = side === "tight" ? (slight ? "Slightly Tight" : "Tight") : slight ? "Slightly Loose" : "Loose";
  }
  return { dimension, bodyCm, chartCm, differenceCm: round1(diff), idealRange: range, label, score: round2(score) };
}

function rangeFor(
  chartType: SizeChart["measurementType"], rule: DimensionRule, pref: FitPreference,
): EaseRange {
  return chartType === "GARMENT" ? rule.ease[pref] : BODY_CHART_OFFSET[pref];
}

/** The value (cm) a size row represents for this body, plus its published range if any. */
function resolveChartValue(row: ChartRow, key: Dimension, bodyCm: number, type: SizeChart["measurementType"]) {
  const lo = row[key];
  if (lo === undefined) return null;
  const hi = row[`${key}Max` as `${Dimension}Max`];
  if (hi === undefined || hi < lo) return { value: lo, range: undefined };
  // BODY ranges: you are inside the range -> perfect; outside -> distance to the nearest edge.
  // GARMENT ranges are unusual; use the midpoint.
  const value = type === "BODY" ? Math.min(hi, Math.max(lo, bodyCm)) : (lo + hi) / 2;
  return { value, range: [lo, hi] as [number, number] };
}

function scoreSize(row: ChartRow, input: RecommendInput): SizeScore {
  const { body, chart, category, fitPreference } = input;
  const dims: DimensionResult[] = [];
  const skipped: Dimension[] = [];
  let usedWeight = 0;
  let total = 0;
  let totalWeight = 0;
  for (const [key, rule] of Object.entries(category.dimensions) as [Dimension, DimensionRule][]) {
    totalWeight += rule.weight;
    const b = body[key];
    const resolved = b === undefined ? null : resolveChartValue(row, key, b, chart.measurementType);
    if (b === undefined || !resolved) { skipped.push(key); continue; }
    const res = scoreDimension(key, b, resolved.value, rule, rangeFor(chart.measurementType, rule, fitPreference));
    if (resolved.range) res.chartRange = resolved.range;
    dims.push(res);
    usedWeight += rule.weight;
    total += res.score * rule.weight;
  }
  return {
    label: row.label,
    score: usedWeight > 0 ? round2(total / usedWeight) : 0,
    coverage: totalWeight > 0 ? round2(usedWeight / totalWeight) : 0,
    dimensions: dims,
    skipped,
  };
}

export function recommend(input: RecommendInput): RecommendationResult {
  const { body, chart, category, fitPreference } = input;
  const warnings: string[] = [];

  const errors = validateBody(body);
  if (errors.length) {
    return { status: "invalid_input", errors, explanation: "Some measurements look wrong. Fix them and try again." };
  }

  const dataStatus = chart.status;
  if (dataStatus === "DEPRECATED") {
    return {
      status: "insufficient_data", missing: [], dataStatus, warnings,
      explanation: "This size chart has been marked deprecated, so FITSYNC will not recommend from it.",
    };
  }

  // Required dimensions: the user must have them, and the chart must provide them.
  const required = (Object.entries(category.dimensions) as [Dimension, DimensionRule][])
    .filter(([, r]) => r.required).map(([k]) => k);
  const missingBody = required.filter((d) => body[d] === undefined);
  if (missingBody.length) {
    return {
      status: "insufficient_data", missing: missingBody, dataStatus, warnings,
      explanation: `Add your ${missingBody.join(", ")} measurement to get a ${category.name.toLowerCase()} recommendation.`,
    };
  }
  const usableRows = chart.rows.filter((row) => required.every((d) => row[d] !== undefined));
  if (usableRows.length === 0) {
    return {
      status: "insufficient_data", missing: required, dataStatus, warnings,
      explanation: `This brand's chart has no ${required.join(", ")} measurements for ${category.name.toLowerCase()}, so a recommendation would be a guess.`,
    };
  }
  if (usableRows.length < chart.rows.length) warnings.push("Some sizes were skipped because the chart is missing key measurements for them.");

  const ranking = usableRows
    .map((row, index) => ({ s: scoreSize(row, input), index }))
    .sort((a, b) => {
      if (b.s.score !== a.s.score) return b.s.score - a.s.score;
      const da = a.s.dimensions.reduce((n, d) => n + Math.abs(d.differenceCm), 0);
      const db = b.s.dimensions.reduce((n, d) => n + Math.abs(d.differenceCm), 0);
      if (da !== db) return da - db;
      return a.index - b.index; // deterministic: chart order
    })
    .map((x) => x.s);

  if (dataStatus === "UNVERIFIED") {
    warnings.push("This size chart is not verified yet. Treat the result as a rough guide.");
  }

  const best = ranking[0];
  if (best.score < MIN_ACCEPTABLE_SCORE) {
    return {
      status: "no_compatible_size", fitPreference, dataStatus, warnings, ranking,
      closest: { size: best.label, score: best.score },
      explanation: `None of this brand's sizes fit your measurements well for a ${fitPreference.toLowerCase()} fit. ${best.label} comes closest, but it would likely be noticeably ${describeProblem(best)}.`,
    };
  }

  const second = ranking[1];
  const margin = second ? best.score - second.score : 0.15;
  if (second && margin < 0.05) {
    warnings.push(`You are between ${best.label} and ${second.label}. Choose ${best.label} for the closer match, or the other if you prefer a different feel.`);
  }
  if (best.coverage < 1) {
    warnings.push(`Based on ${Math.round(best.coverage * 100)}% of the measurements for this category. Add more measurements to improve accuracy.`);
  }

  const marginFactor = 0.85 + 0.15 * Math.min(1, margin / 0.15);
  let confidence = best.score * (0.5 + 0.5 * best.coverage) * marginFactor;
  if (dataStatus === "UNVERIFIED") confidence = Math.min(confidence * 0.7, UNVERIFIED_CONFIDENCE_CAP);
  confidence = round2(Math.max(0, Math.min(1, confidence)));

  const compatibility: Partial<Record<Dimension, FitLabel>> = {};
  for (const d of best.dimensions) compatibility[d.dimension] = d.label;

  return {
    status: "ok",
    recommendedSize: best.label,
    fitPreference,
    confidence,
    garmentCut: chart.garmentCut ?? null,
    achievedFit: achievedFit(best, chart.measurementType, category),
    compatibility,
    alternatives: ranking.slice(1, 3).map((r) => ({ size: r.label, score: r.score })),
    ranking,
    explanation: explain(best, chart.measurementType, fitPreference),
    warnings,
    dataStatus,
  };
}

/** Which fit preference's ideal ease range the chosen size's primary measurement falls into. */
function achievedFit(best: SizeScore, type: SizeChart["measurementType"], category: CategoryConfig): AchievedFit {
  if (type !== "GARMENT") return null; // body charts: the real fit depends on the garment's cut, which the chart does not say
  const primary = best.dimensions.find((d) => category.dimensions[d.dimension]?.required) ?? best.dimensions[0];
  const rule = primary && category.dimensions[primary.dimension];
  if (!primary || !rule) return null;
  const ease = primary.differenceCm;
  const order: FitPreference[] = ["SLIM", "REGULAR", "RELAXED", "OVERSIZED"];
  const first = rule.ease[order[0]];
  const last = rule.ease[order[3]];
  if (ease < first.min) return "TIGHTER_THAN_SLIM";
  if (ease > last.max) return "LOOSER_THAN_OVERSIZED";
  // pick the preference whose range centre is closest to the achieved ease
  return order.reduce((a, b) => {
    const mid = (p: FitPreference) => (rule.ease[p].min + rule.ease[p].max) / 2;
    return Math.abs(mid(b) - ease) < Math.abs(mid(a) - ease) ? b : a;
  });
}

function describeProblem(s: SizeScore): string {
  const worst = [...s.dimensions].sort((a, b) => a.score - b.score)[0];
  if (!worst) return "off";
  return `${worst.label.toLowerCase().includes("tight") ? "tight" : "loose"} at the ${worst.dimension}`;
}

function explain(best: SizeScore, type: SizeChart["measurementType"], pref: FitPreference): string {
  const parts = best.dimensions.map((d) => {
    const what = type === "GARMENT" ? "garment" : "chart";
    const shown = d.chartRange ? `${round1(d.chartRange[0])}–${round1(d.chartRange[1])}` : `${round1(d.chartCm)}`;
    const gap = d.chartRange ? (d.differenceCm === 0 ? "inside the range" : `${fmt(d.differenceCm)} cm outside the range`) : `${fmt(d.differenceCm)} cm`;
    return `${d.dimension}: ${what} ${shown} cm vs body ${round1(d.bodyCm)} cm (${gap}) → ${d.label}`;
  });
  const head = `Size ${best.label} gives the best overall match for a ${pref.toLowerCase()} fit.`;
  const how = type === "GARMENT"
    ? " Garment sizes are compared against your body plus the ease expected for this fit."
    : " This brand publishes body measurements, so they are compared to yours directly.";
  return `${head} ${parts.join("; ")}.${how}`;
}
