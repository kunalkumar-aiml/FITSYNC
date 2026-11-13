import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { VersionActions } from "@/components/admin/version-actions";
import { DataBadge, GENDER_NAMES, SOURCE_NAMES } from "@/components/badges";
import { DIMENSIONS, type ChartRow } from "@/lib/engine";
export const metadata = { title: "Source verification · Admin" };
export const dynamic = "force-dynamic";

/** The review queue: everything that is not yet verified, oldest first. Only a person can verify. */
export default async function Verification() {
  await requirePageAdmin();
  const queue = await db.brandSizeChartVersion.findMany({
    where: { status: { in: ["NEEDS_HUMAN_VERIFICATION", "UNVERIFIED"] } }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 100,
    include: { chart: { include: { brand: true, category: true, product: true } }, researchSources: { take: 1, orderBy: { retrievedAt: "desc" } } },
  });
  return (
    <>
      <AdminHeader title="Source verification" lede="Open the source, compare every row, resolve any unclear meaning, then approve or reject. Extracted data is never verified automatically." />
      {queue.length === 0 ? <p className="text-muted">Nothing is waiting for review.</p> : (
        <ul className="border-t border-line">
          {queue.map((v) => {
            const rows = v.rows as ChartRow[];
            const dims = DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
            const amb = (Array.isArray(v.ambiguousDimensions) ? v.ambiguousDimensions : []) as string[];
            return (
              <li key={v.id} className="border-b border-line py-5 grid lg:grid-cols-[1fr_auto] gap-4">
                <div className="min-w-0">
                  <p className="font-medium"><Link className="link" href={`/admin/charts/${v.chartId}`}>{v.chart.brand.name}, {v.chart.category.name}</Link> <span className="text-muted font-normal">v{v.version}</span> <DataBadge status={v.status} demo={v.chart.brand.isDemo} /></p>
                  <p className="text-xs text-muted mt-1">{GENDER_NAMES[v.chart.gender]}, {v.chart.region}{v.chart.product ? `, product: ${v.chart.product.name}` : ""}. {SOURCE_NAMES[v.sourceType] ?? v.sourceType}. {rows.length} sizes. Unit at source {v.originalUnit}.</p>
                  {amb.length > 0 && <p className="text-xs text-warn mt-1">Meaning not stated for: {amb.join(", ")}.</p>}
                  {v.researchSources[0]?.note && <p className="text-xs text-muted mt-1 max-w-prose">Pipeline: {v.researchSources[0].note}</p>}
                </div>
                <VersionActions v={{ id: v.id, status: v.status, ambiguous: amb, dims, semantics: (v.measurementSemantics ?? {}) as Record<string, string>, measurementType: v.measurementType, label: `${v.chart.brand.name}, ${v.chart.category.name}, version ${v.version}` }} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
