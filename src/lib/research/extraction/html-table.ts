export type Table = string[][];

const ENT: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&ndash;": "-", "&mdash;": "-" };
const clean = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, (m) => ENT[m.toLowerCase()] ?? " ").replace(/\s+/g, " ").trim();

/** Dependency-free <table> extractor. Layout-agnostic: returns every table as rows of cell text. */
export function extractTables(html: string): Table[] {
  const out: Table[] = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const t of tables) {
    const rows = (t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((tr) => (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(clean));
    const nonEmpty = rows.filter((r) => r.some(Boolean));
    if (nonEmpty.length >= 2) out.push(nonEmpty);
  }
  return out;
}

export const pageText = (html: string) =>
  clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
