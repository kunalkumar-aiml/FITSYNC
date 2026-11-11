import { round1, toCm, type ChartRow, type Unit } from "../../engine";

/** Convert every numeric value to centimetres. Pure unit conversion: never halves, doubles or "fixes" numbers. */
export function rowsToCm(rows: ChartRow[], unit: Unit): ChartRow[] {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "label" ? v : round1(toCm(v as number, unit))])) as ChartRow);
}
