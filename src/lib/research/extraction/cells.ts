export type Cell = { min: number; max?: number } | { open: string } | null;

const NUM = "(\\d+(?:[.,]\\d+)?)";
const RANGE = new RegExp(`^${NUM}\\s*(?:-|–|—|to)\\s*${NUM}$`, "i");
const SINGLE = new RegExp(`^${NUM}(?:\\s*(?:cm|in|inch|inches|"))?$`, "i");
const n = (s: string) => parseFloat(s.replace(",", "."));

/** A published cell: "37.5 - 41", "98", "<31", "51.5+", "" . Open-ended values are reported, never completed. */
export function parseCell(raw: string): Cell {
  const t = raw.replace(/\s+/g, " ").trim().replace(/\s*(cm|in|inch|inches)\.?$/i, "");
  if (!t || /^[-–—]$/.test(t)) return null;
  if (/^[<>≤≥]|\+$|^under|^over|and (under|over|up)/i.test(t)) return { open: raw.trim() };
  const r = RANGE.exec(t); if (r) return { min: n(r[1]), max: n(r[2]) };
  const s = SINGLE.exec(t); if (s) return { min: n(s[1]) };
  return { open: raw.trim() };
}
