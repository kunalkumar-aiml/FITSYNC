import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader, Stat } from "@/components/admin/admin-header";
import { CoverageTable } from "@/components/admin/coverage-table";
import { getCoverageRows } from "@/lib/coverage";
import { CATEGORY_CONFIGS, type ChartRow } from "@/lib/engine";
import { validateChart } from "@/lib/research/validation/validate-chart";
export const metadata = { title: "Data quality · Admin" };
export const dynamic = "force-dynamic";

export default async function Quality() {
  await requirePageAdmin();
  const [rows, versions, brandNotes, productNotes, productsWithoutChart] = await Promise.all([
    getCoverageRows(),
    db.brandSizeChartVersion.findMany({ where: { status: { in: ["VERIFIED", "UNVERIFIED", "NEEDS_HUMAN_VERIFICATION"] }, chart: { brand: { isDemo: false } } }, include: { chart: { include: { brand: true, category: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.brandCoverageNote.count({ where: { productId: null } }),
    db.brandCoverageNote.count({ where: { productId: { not: null } } }),
    db.product.count({ where: { charts: { none: {} } } }),
  ]);
  const issues = versions.flatMap((v) => {
    const res = validateChart(v.rows as ChartRow[], "CM");
    const amb = Array.isArray(v.ambiguousDimensions) ? (v.ambiguousDimensions as string[]) : [];
    const out = res.issues.map((i) => ({ v, level: i.level, message: i.message }));
    if (amb.length) out.push({ v, level: "warning" as const, message: `Meaning not stated for ${amb.join(", ")}.` });
    if (v.measurementType === "UNKNOWN") out.push({ v, level: "warning" as const, message: "Chart type unknown (body or garment not stated)." });
    if (v.chart.fitCut === "UNKNOWN") out.push({ v, level: "warning" as const, message: "Garment cut not stated by the source." });
    return out;
  });
  const missing = rows.filter((r) => r.status === "Missing").length;
  return (
    <>
      <AdminHeader title="Data quality" lede="What is covered, what is missing, and what needs a closer look. Missing brand data and missing product data are tracked separately." />
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat label="Brand × category gaps" value={missing} note="no brand-level chart" />
        <Stat label="Brand-level missing notes" value={brandNotes} />
        <Stat label="Product-level missing notes" value={productNotes} />
        <Stat label="Products without a chart" value={productsWithoutChart} />
      </dl>
      <section className="mt-12">
        <h2 className="display-sm">Checks on current charts</h2>
        <p className="mt-2 text-sm text-muted">Automatic consistency checks (plausible ranges, sizes increasing, duplicates) plus unclear meaning, unit or cut.</p>
        {issues.length === 0 ? <p className="mt-3 text-sm text-muted">No problems found.</p> : (
          <table className="table-x mt-4"><thead><tr><th>Chart</th><th>Level</th><th>Finding</th></tr></thead>
            <tbody>{issues.slice(0, 200).map((i, k) => <tr key={k}><td><Link href={`/admin/charts/${i.v.chartId}`} className="link">{i.v.chart.brand.name}, {i.v.chart.category.name} v{i.v.version}</Link></td><td className={i.level === "error" ? "text-bad" : "text-warn"}>{i.level}</td><td className="text-muted">{i.message}</td></tr>)}</tbody></table>
        )}
      </section>
      <section className="mt-12">
        <h2 className="display-sm">Coverage</h2>
        <div className="mt-4"><CoverageTable rows={rows} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))} /></div>
      </section>
    </>
  );
}
