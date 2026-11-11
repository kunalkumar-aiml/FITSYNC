import type { Dimension, GarmentOnlyDimension } from "../../engine";

export type Key = Dimension | GarmentOnlyDimension;

/**
 * Published column label -> FITSYNC dimension. Only label SPELLING is normalised (bust -> chest).
 * This never changes what a number means: whether it is body or garment is decided separately from the page text.
 */
const MAP: [RegExp, Key][] = [
  [/^(chest|bust|chest\/bust|bust\/chest|chest to fit|bust size)\b/i, "chest"],
  [/^(natural )?waist\b/i, "waist"],
  [/^(hip|hips|seat)\b/i, "hips"],
  [/^(across )?shoulders?\b|^shoulder width\b/i, "shoulder"],
  [/^(neck|collar)\b/i, "neck"],
  [/^thigh\b/i, "thigh"],
  [/^inseam\b|^inside leg\b/i, "inseam"],
  [/^(arm length|arm)\b/i, "armLength"],
  [/^sleeve( length)?\b/i, "sleeveLength"],
  [/^(garment |body |top |product )?length\b|^hps to hem\b/i, "garmentLength"],
  [/^rise\b/i, "rise"],
  [/^leg opening\b|^hem( width)?\b/i, "legOpening"],
];

export function dimensionFor(label: string): Key | null {
  const clean = label.replace(/\(.*?\)/g, "").replace(/[*:]/g, "").trim();
  for (const [re, key] of MAP) if (re.test(clean)) return key;
  return null;
}

export function unitFromLabel(label: string): "CM" | "IN" | null {
  if (/\((in|inch|inches)\.?\)|\binch(es)?\b/i.test(label)) return "IN";
  if (/\((cm|centimet\w+)\.?\)|\bcm\b/i.test(label)) return "CM";
  return null;
}
