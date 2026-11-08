import type { BodyMeasurements, Unit } from "./types";

export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;

export const toCm = (value: number, unit: Unit) => (unit === "IN" ? value * CM_PER_IN : value);
export const fromCm = (value: number, unit: Unit) => (unit === "IN" ? value / CM_PER_IN : value);
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Convert a form payload (values in the user's unit) to cm. Undefined / null / "" are dropped. */
export function normalizeMeasurements(
  input: Record<string, number | null | undefined>,
  unit: Unit,
): BodyMeasurements {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    if (k === "weightKg") out[k] = v;
    else out[k] = round1(toCm(v, unit));
  }
  return out as BodyMeasurements;
}
