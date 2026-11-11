import type { BodyMeasurements, Dimension, GarmentOnlyDimension } from "./types";

/** Plausible adult ranges in cm. Anything outside is almost certainly a typo or a unit mistake. */
export const LIMITS: Record<Dimension | "height", [number, number]> = {
  height: [120, 230],
  chest: [60, 170],
  waist: [50, 170],
  hips: [60, 180],
  shoulder: [30, 65],
  armLength: [45, 100],
  inseam: [50, 100],
  neck: [28, 55],
  thigh: [35, 100],
};

/** Plausible garment-only ranges (cm), used when validating imported charts. */
export const GARMENT_LIMITS: Record<GarmentOnlyDimension, [number, number]> = {
  garmentLength: [20, 140], sleeveLength: [5, 100], rise: [15, 50], legOpening: [10, 60],
};

export function validateBody(body: BodyMeasurements): string[] {
  const errors: string[] = [];
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const v = (body as Record<string, number | undefined>)[key];
    if (v === undefined) continue;
    if (!Number.isFinite(v)) errors.push(`${key} must be a number`);
    else if (v < min || v > max) errors.push(`${key} of ${v} cm is outside the expected range (${min}–${max} cm). Check the unit.`);
  }
  const w = body.weightKg;
  if (w !== undefined && (!Number.isFinite(w) || w < 30 || w > 250)) errors.push("weight must be between 30 and 250 kg");
  if (body.chest !== undefined && body.shoulder !== undefined && body.shoulder > body.chest) {
    errors.push("shoulder width cannot be larger than chest circumference");
  }
  return errors;
}
