import type { Dimension } from "../../engine";

/**
 * Decide, from the page's own words, what the published numbers represent.
 * If the page does not say, the answer is UNKNOWN and the circumference dimensions become ambiguous.
 * We never infer meaning from the size of the numbers and never halve/double anything.
 */
export function detectMeasurementType(text: string): { type: "BODY" | "GARMENT" | "UNKNOWN"; evidence: string | null } {
  const body = /(measurements? (on|in|of) the (size )?chart (are|is|refer to) (your )?body|body measurements?|designed to fit the body measurements|refer to body size|body size, not garment)/i.exec(text);
  const garment = /(garment (measurements?|dimensions?)|measurements? of the (garment|product|item)|product measurements?|flat[- ]lay)/i.exec(text);
  if (body && !garment) return { type: "BODY", evidence: text.slice(Math.max(0, body.index - 20), body.index + 90).trim() };
  if (garment && !body) return { type: "GARMENT", evidence: text.slice(Math.max(0, garment.index - 20), garment.index + 90).trim() };
  return { type: "UNKNOWN", evidence: null };
}

const CIRC: Dimension[] = ["chest", "waist", "hips", "shoulder", "thigh", "neck", "armLength", "inseam"];
export const ambiguousFor = (type: "BODY" | "GARMENT" | "UNKNOWN", present: Dimension[]) => (type === "UNKNOWN" ? present.filter((d) => CIRC.includes(d)) : []);
