import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader, Stat } from "@/components/admin/admin-header";
export const metadata = { title: "Feedback analytics · Admin" };
export const dynamic = "force-dynamic";

/**
 * Actual fit (what people reported) against predicted fit (what FITSYNC recommended), per brand and category.
 * Aggregates only: no measurements, names or emails are read or shown. Groups with fewer than 5 reports are labelled
 * as too small to draw conclusions from.
 */
export default async function Feedback() {
  await requirePageAdmin();
  const reports = await db.userFitFeedback.findMany({
    select: { outcome: true, purchasedSize: true, recommendation: { select: { recommendedSize: true, chartVersion: { select: { status: true, chart: { select: { brand: { select: { name: true } }, category: { select: { name: true } } } } } } } } },
    take: 5000, orderBy: { createdAt: "desc" },
  });
  type G = { key: string; n: number; perfect: number; tight: number; loose: number; tookRecommended: number; perfectWhenRecommended: number };
  const groups = new Map<string, G>();
  for (const r of reports) {
    const key = `${r.recommendation.chartVersion.chart.brand.name} · ${r.recommendation.chartVersion.chart.category.name}`;
    const g = groups.get(key) ?? { key, n: 0, perfect: 0, tight: 0, loose: 0, tookRecommended: 0, perfectWhenRecommended: 0 };
    g.n++;
    if (r.outcome === "PERFECT") g.perfect++; else if (r.outcome === "TOO_TIGHT") g.tight++; else g.loose++;
    const took = !!r.recommendation.recommendedSize && r.purchasedSize.trim().toUpperCase() === r.recommendation.recommendedSize.toUpperCase();
    if (took) { g.tookRecommended++; if (r.outcome === "PERFECT") g.perfectWhenRecommended++; }
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.n - a.n);
  const total = reports.length;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const perfect = reports.filter((r) => r.outcome === "PERFECT").length;
  return (
    <>
      <AdminHeader title="Feedback analytics" lede="Reported fit compared with predictions. These numbers will eventually calibrate the ease allowances; until a group has enough reports, treat it as anecdote, not evidence." />
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat label="Fit reports" value={total} />
        <Stat label="Reported perfect" value={pct(perfect, total)} />
        <Stat label="Too tight" value={pct(reports.filter((r) => r.outcome === "TOO_TIGHT").length, total)} />
        <Stat label="Too loose" value={pct(reports.filter((r) => r.outcome === "TOO_LOOSE").length, total)} />
      </dl>
      {list.length === 0 ? <p className="mt-10 text-muted">No fit reports yet.</p> : (
        <div className="mt-10 overflow-x-auto"><table className="table-x min-w-[44rem]">
          <thead><tr><th>Brand and category</th><th>Reports</th><th>Perfect</th><th>Too tight</th><th>Too loose</th><th>Bought the predicted size</th><th>Perfect when they did</th></tr></thead>
          <tbody>{list.map((g) => <tr key={g.key}><td className="font-medium">{g.key}{g.n < 5 && <span className="block text-2xs text-muted font-normal">fewer than 5 reports</span>}</td><td>{g.n}</td><td>{pct(g.perfect, g.n)}</td><td>{pct(g.tight, g.n)}</td><td>{pct(g.loose, g.n)}</td><td>{pct(g.tookRecommended, g.n)}</td><td>{pct(g.perfectWhenRecommended, g.tookRecommended)}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
