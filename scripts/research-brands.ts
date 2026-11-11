/**
 * Live research run:  npm run research [-- path/to/targets.json]
 * Fetches each target politely (SSRF-safe, robots.txt, no bypassing), extracts the chart with the right adapter,
 * validates it, and writes raw/ + csv/ + normalized/ + reports/ and merges into prisma/data/charts.json (UNVERIFIED).
 * Re-runnable: identical charts are skipped; changed charts update the entry (a new DB version on import).
 * Nothing is ever marked VERIFIED here.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runTargets } from "../src/lib/research/ingestion/runner";
import { mergeCharts, outcomeToStored, type ChartsFile } from "../src/lib/research/ingestion/merge";
import { pageText } from "../src/lib/research/extraction/html-table";
import { writeChartFiles } from "../src/lib/research/ingestion/files";
import type { Target } from "../src/lib/research/types";

const DATA = join(__dirname, "..", "prisma", "data");
const R = join(DATA, "research");

async function main() {
  const targets: Target[] = JSON.parse(readFileSync(process.argv[2] ?? join(R, "targets.json"), "utf8"));
  mkdirSync(join(R, "raw"), { recursive: true });
  const raw: Record<string, string> = {};
  const outcomes = await runTargets(targets, { onPage: (t, p) => { if (p.ok) raw[t.url] = pageText(p.body).slice(0, 30_000); } });

  const file = JSON.parse(readFileSync(join(DATA, "charts.json"), "utf8")) as ChartsFile;
  const stored = outcomes.map(outcomeToStored).filter((x): x is NonNullable<typeof x> => !!x);
  const m = mergeCharts(file, stored);
  writeFileSync(join(DATA, "charts.json"), JSON.stringify(file, null, 1));
  for (const c of [...m.added, ...m.updated]) writeChartFiles(R, c);

  const ledgerPath = join(R, "reports", "source-log.json");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const date = new Date().toISOString().slice(0, 10);
  for (const o of outcomes) {
    ledger.push({ brand: o.target.brand, target: o.target.productName ?? o.target.url, method: `pipeline:${o.adapter ?? "none"}`, status: o.status, date, url: o.target.url, reason: o.reason });
    if (raw[o.target.url]) writeFileSync(join(R, "raw", `${o.target.brand}-${Buffer.from(o.target.url).toString("base64url").slice(-12)}.json`), JSON.stringify({ url: o.target.url, retrievedAt: o.retrievedAt, textExcerpt: raw[o.target.url] }, null, 1));
  }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));

  for (const o of outcomes) console.log(`${o.status.padEnd(26)} ${o.target.brand} ${o.target.productName ?? ""} ${o.reason}`);
  console.log(`\nCharts: ${m.added.length} added, ${m.updated.length} updated, ${m.skipped.length} unchanged. Next: npm run research:csv && npm run research:import`);
}
main().catch((e) => { console.error(e); process.exit(1); });
