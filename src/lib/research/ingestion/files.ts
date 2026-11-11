import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChartRow } from "../../engine";
import { rowsToCm } from "../normalization/to-cm";
import { fileStem, rowsToCsv } from "./csv-writer";
import { storedHash, type StoredChart } from "./merge";
import type { Unit } from "../../engine";

export type WrittenFiles = { stem: string; csv: string; meta: string; normalized: string };

/** For every stored chart write: csv/<stem>.csv (cm), csv/<stem>.meta.json (provenance), normalized/<stem>.json. */
export function writeChartFiles(researchDir: string, c: StoredChart): WrittenFiles {
  const rowsCm = rowsToCm(c.rows as unknown as ChartRow[], c.unit as Unit);
  const stem = fileStem({ brand: c.brand, category: c.category, gender: c.gender, region: c.region, product: c.product?.name, hash: storedHash({ ...c, rows: rowsCm as never }) });
  for (const d of ["csv", "normalized"]) mkdirSync(join(researchDir, d), { recursive: true });
  const meta = {
    brand: c.brand, category: c.category, gender: c.gender, region: c.region, productLine: c.productLine, fitCut: c.fitCut,
    measurementType: c.measurementType, measurementSemantics: c.measurementSemantics ?? {}, ambiguousDimensions: c.ambiguousDimensions ?? [],
    sourceType: c.sourceType, sourceUrl: c.sourceUrl, sourceDomain: c.sourceDomain, extractionMethod: c.extractionMethod,
    retrievedAt: c.retrievedAt, originalUnit: c.unit, storedUnit: "CM", verificationStatus: c.verificationStatus,
    columnLabels: c.columnLabels ?? {}, product: c.product ?? null, notes: c.sourceNote,
    csvFile: `${stem}.csv`, sizeLabels: c.rows.map((r) => r.label),
  };
  writeFileSync(join(researchDir, "csv", `${stem}.csv`), rowsToCsv(rowsCm));
  writeFileSync(join(researchDir, "csv", `${stem}.meta.json`), JSON.stringify(meta, null, 2));
  writeFileSync(join(researchDir, "normalized", `${stem}.json`), JSON.stringify({ ...meta, unit: "CM", rows: rowsCm }, null, 2));
  return { stem, csv: `csv/${stem}.csv`, meta: `csv/${stem}.meta.json`, normalized: `normalized/${stem}.json` };
}
