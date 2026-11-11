/** Validates prisma/data/charts.json: provenance, structure, units, duplicates, CSV round-trip. Exit 1 on errors. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateChart } from "../src/lib/research/validation/validate-chart";
import { rowsToCm } from "../src/lib/research/normalization/to-cm";
import { rowsToCsv } from "../src/lib/research/ingestion/csv-writer";
import { parseChartCsv } from "../src/lib/csv";
import type { StoredChart } from "../src/lib/research/ingestion/merge";
import type { ChartRow, Unit } from "../src/lib/engine";

const file = JSON.parse(readFileSync(join(__dirname, "..", "prisma", "data", "charts.json"), "utf8")) as { charts: StoredChart[] };
const errors: string[] = [], warnings: string[] = [];
const canon = (rows: unknown[]) => JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))));
const seen = new Set<string>();
for (const c of file.charts) {
  const id = `${c.brand}/${c.category}/${c.gender}/${c.region}/${c.product?.name ?? "-"}`;
  const need = ["sourceUrl", "sourceDomain", "sourceType", "extractionMethod", "retrievedAt", "verificationStatus", "measurementType", "unit"] as const;
  for (const k of need) if (!c[k]) errors.push(`${id}: missing ${k}`);
  if (c.sourceUrl && new URL(c.sourceUrl).host !== c.sourceDomain) errors.push(`${id}: sourceDomain does not match sourceUrl`);
  if (c.verificationStatus === "VERIFIED") errors.push(`${id}: research data must not be pre-verified`);
  if (c.product && !c.product.marketplace && c.sourceType === "MARKETPLACE_LISTING") errors.push(`${id}: marketplace listing without marketplace`);
  if (c.product && !c.product.brand) errors.push(`${id}: product without brand identity`);
  if (c.sourceType === "MARKETPLACE_LISTING" && c.measurementType === "BODY") warnings.push(`${id}: marketplace listing declared BODY`);
  const key = [c.brand, c.category, c.gender, c.region, c.productLine, c.sourceUrl].join("|");
  if (seen.has(key)) errors.push(`${id}: duplicate chart for the same source`); seen.add(key);
  const v = validateChart(c.rows as unknown as ChartRow[], c.unit as Unit);
  for (const i of v.issues) (i.level === "error" ? errors : warnings).push(`${id}: ${i.message}`);
  // CSV round trip: what we export must re-import to the same numbers
  const cm = rowsToCm(c.rows as unknown as ChartRow[], c.unit as Unit);
  const back = parseChartCsv(rowsToCsv(cm), "CM");
  if (back.errors.length || canon(back.rows) !== canon(cm)) errors.push(`${id}: CSV round-trip mismatch ${back.errors[0] ?? ""}`);
}
const unitDir = join(__dirname, "..", "prisma", "data", "research", "csv");
if (!existsSync(unitDir)) warnings.push("research/csv is empty. Run npm run research:csv");
console.log(`${file.charts.length} charts checked. ${errors.length} error(s), ${warnings.length} warning(s).`);
errors.forEach((e) => console.error("ERROR  " + e)); warnings.forEach((w) => console.warn("warn   " + w));
process.exit(errors.length ? 1 : 0);
