import { adapterFor } from "../adapters";
import { fetchPage } from "../safe-fetch";
import { chartHash } from "./csv-writer";
import { rowsToCm } from "../normalization/to-cm";
import { validateChart, type Issue } from "../validation/validate-chart";
import type { ExtractedChart, PageResult, ResearchStatus, Target } from "../types";
import type { ChartRow } from "../../engine";

export type TargetOutcome = {
  target: Target; status: ResearchStatus; reason: string; httpStatus?: number; adapter?: string;
  chart?: ExtractedChart; rowsCm?: ChartRow[]; hash?: string; issues: Issue[]; retrievedAt: string;
};

export type RunnerOptions = { getPage?: (url: string) => Promise<PageResult>; now?: () => Date; onPage?: (target: Target, page: PageResult) => void };

/** Run the pipeline for a list of targets. Each target fails independently; nothing is guessed. */
export async function runTargets(targets: Target[], o: RunnerOptions = {}): Promise<TargetOutcome[]> {
  const getPage = o.getPage ?? ((u: string) => fetchPage(u));
  const out: TargetOutcome[] = [];
  const seen = new Set<string>();
  for (const target of targets) {
    const retrievedAt = (o.now?.() ?? new Date()).toISOString();
    const base = { target, retrievedAt, issues: [] as Issue[] };
    if (seen.has(target.url)) { out.push({ ...base, status: "SOURCE_UNAVAILABLE", reason: "Duplicate URL in this run; skipped." }); continue; }
    seen.add(target.url);
    let host: string;
    try { host = new URL(target.url).hostname; } catch { out.push({ ...base, status: "INVALID_DATA", reason: "Invalid URL." }); continue; }
    const adapter = adapterFor(host);
    if (!adapter) { out.push({ ...base, status: "SOURCE_UNAVAILABLE", reason: `No adapter for ${host}.` }); continue; }
    const page = await getPage(target.url);
    o.onPage?.(target, page);
    if (!page.ok) { out.push({ ...base, status: page.status, httpStatus: page.httpStatus, reason: page.reason, adapter: adapter.id }); continue; }
    const res = adapter.extract({ url: new URL(page.finalUrl), body: page.body, target });
    if (!res.chart) { out.push({ ...base, status: res.status, reason: res.reason, httpStatus: page.status, adapter: adapter.id }); continue; }
    const v = validateChart(res.chart.rows, res.chart.unit);
    if (!v.ok) { out.push({ ...base, status: "INVALID_DATA", reason: v.issues.filter((i) => i.level === "error").map((i) => i.message).join(" "), issues: v.issues, httpStatus: page.status, adapter: adapter.id, chart: res.chart }); continue; }
    const rowsCm = rowsToCm(res.chart.rows, res.chart.unit);
    const hasWarn = v.issues.some((i) => i.level === "warning");
    out.push({
      ...base, adapter: adapter.id, httpStatus: page.status, chart: res.chart, rowsCm, issues: v.issues,
      hash: chartHash({ sourceUrl: page.finalUrl, gender: target.gender, region: target.region, rowsCm }),
      status: res.status === "SUCCESS" && hasWarn ? "NEEDS_HUMAN_VERIFICATION" : res.status,
      reason: res.reason + (hasWarn ? " Validation warnings need a human look." : ""),
    });
  }
  return out;
}

export const isUsable = (s: ResearchStatus) => s === "SUCCESS" || s === "PARTIAL_SUCCESS" || s === "NEEDS_HUMAN_VERIFICATION";
