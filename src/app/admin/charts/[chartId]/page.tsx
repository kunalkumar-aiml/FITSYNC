import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { VersionActions } from "@/components/admin/version-actions";
import { DataBadge, DIM_NAMES, GENDER_NAMES, SOURCE_NAMES } from "@/components/badges";
import { DIMENSIONS, GARMENT_ONLY_DIMENSIONS, round1, type ChartRow } from "@/lib/engine";
export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
const safeHref = (u: string | null) => { try { return u && new URL(u).protocol === "https:" ? u : null; } catch { return null; } };

export default async function ChartHistory({ params }: { params: { chartId: string } }) {
  await requirePageAdmin();
  const chart = await db.brandSizeChart.findUnique({
    where: { id: params.chartId },
    include: { brand: true, category: true, product: true, versions: { orderBy: { version: "desc" }, include: { verifications: { orderBy: { createdAt: "desc" }, include: { admin: { select: { email: true } } } }, verifiedBy: { select: { email: true } } } } },
  });
  if (!chart) notFound();
  return (
    <>
      <AdminHeader title={`${chart.brand.name}, ${chart.category.name}`} lede={`${GENDER_NAMES[chart.gender]} sizing, ${chart.region} size system${chart.productLine ? `, ${chart.productLine}` : ""}. Cut: ${chart.fitCut.toLowerCase()}. ${chart.product ? `Product-specific: ${chart.product.name}.` : "Brand-level chart."}`} />
      <ol className="space-y-12">
        {chart.versions.map((v) => {
          const rows = v.rows as ChartRow[];
          const dims = DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
          const extra = GARMENT_ONLY_DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
          const semantics = (v.measurementSemantics ?? {}) as Record<string, string>;
          const amb = (Array.isArray(v.ambiguousDimensions) ? v.ambiguousDimensions : []) as string[];
          const href = safeHref(v.sourceUrl);
          return (
            <li key={v.id} className="rule pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Version {v.version} <span className="ml-2 align-middle"><DataBadge status={v.status} demo={chart.brand.isDemo} /></span></h2>
                <VersionActions v={{ id: v.id, status: v.status, ambiguous: amb, dims, semantics, measurementType: v.measurementType, label: `${chart.brand.name}, ${chart.category.name}, version ${v.version}` }} />
              </div>
              <p className="mt-2 text-xs text-muted">Chart type: {v.measurementType.toLowerCase()}. Unit at source: {v.originalUnit}. {SOURCE_NAMES[v.sourceType] ?? v.sourceType}, {v.extractionMethod ?? "n/a"}. Retrieved {fmt(v.retrievedAt)}. {v.verifiedAt ? `Verified ${fmt(v.verifiedAt)} by ${v.verifiedBy?.email ?? "a removed account"}.` : ""}</p>
              {href ? <a href={href} className="text-xs link break-all" target="_blank" rel="noopener noreferrer nofollow">{href}</a> : null}
              {v.sourceNote && <p className="mt-1 text-xs text-muted whitespace-pre-line max-w-prose">{v.sourceNote}</p>}
              <div className="mt-4 overflow-x-auto"><table className="table-x">
                <thead><tr><th>Size</th>{[...dims, ...extra].map((d) => <th key={d}>{DIM_NAMES[d]}<span className="block font-normal">{amb.includes(d) ? "AMBIGUOUS" : semantics[d] ?? (v.measurementType === "UNKNOWN" ? "not stated" : v.measurementType.toLowerCase())}</span></th>)}</tr></thead>
                <tbody>{rows.map((r) => <tr key={r.label}><td className="font-semibold">{r.label}</td>{[...dims, ...extra].map((d) => { const hi = (r as Record<string, unknown>)[`${d}Max`] as number | undefined; return <td key={d}>{r[d] === undefined ? "–" : hi !== undefined ? `${round1(r[d]!)}–${round1(hi)}` : round1(r[d]!)}</td>; })}</tr>)}</tbody>
              </table></div>
              {v.verifications.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-muted">{v.verifications.map((d) => <li key={d.id}><span className="text-ink font-medium">{d.action.toLowerCase()}</span> by {d.admin?.email ?? "a removed account"}, {fmt(d.createdAt)}{d.note ? `: ${d.note}` : ""}</li>)}</ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
