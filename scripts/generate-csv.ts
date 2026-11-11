/** charts.json -> research/csv/*.csv + *.meta.json, research/normalized/*.json, research/reports/*. Safe to re-run. */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildReports, toMarkdown, type LedgerEntry } from "../src/lib/research/ingestion/reports";
import { writeChartFiles } from "../src/lib/research/ingestion/files";
import type { StoredChart } from "../src/lib/research/ingestion/merge";

const DATA = join(__dirname, "..", "prisma", "data");
const R = join(DATA, "research");
const file = JSON.parse(readFileSync(join(DATA, "charts.json"), "utf8")) as { charts: StoredChart[]; extraBrands?: { slug: string; name: string }[]; marketplaces?: { slug: string }[] };
const ledger: LedgerEntry[] = JSON.parse(readFileSync(join(R, "reports", "source-log.json"), "utf8"));
const brandsFile = JSON.parse(readFileSync(join(DATA, "brands.json"), "utf8")) as { slug: string; name: string }[];

for (const d of ["csv", "normalized"]) { mkdirSync(join(R, d), { recursive: true }); for (const f of readdirSync(join(R, d))) rmSync(join(R, d, f)); }
const written = file.charts.map((c) => ({ chart: c, ...writeChartFiles(R, c) }));

const rep = buildReports(file.charts, ledger, brandsFile, (file.marketplaces ?? []).map((m) => m.slug));
const md = toMarkdown(rep);
mkdirSync(join(R, "reports"), { recursive: true });
const w = (n: string, v: unknown) => writeFileSync(join(R, "reports", n), typeof v === "string" ? v : JSON.stringify(v, null, 2));
w("brand-coverage.json", rep.coverage); w("brand-coverage.md", md.coverage);
w("missing-data.json", rep.missing); w("missing-data.md", md.missing);
w("failed-research.json", rep.failed); w("failed-research.md", md.failed);
w("data-quality.json", rep.quality); w("data-quality.md", md.quality);
w("source-manifest.json", rep.manifest); w("summary.json", rep.summary);
console.log(`Wrote ${written.length} CSV + metadata + normalized files and 5 reports.`);
console.log(JSON.stringify(rep.summary, null, 1));
