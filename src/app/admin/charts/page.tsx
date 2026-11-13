import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { ChartImport } from "@/components/admin/chart-import";
import { DataBadge, GENDER_NAMES, SOURCE_NAMES } from "@/components/badges";
import { CATEGORY_CONFIGS } from "@/lib/engine";
export const metadata = { title: "Size charts · Admin" };
export const dynamic = "force-dynamic";

const STATUSES = ["VERIFIED", "UNVERIFIED", "NEEDS_HUMAN_VERIFICATION", "INVALID", "DEPRECATED"] as const;

export default async function Charts(props: { searchParams: Promise<{ status?: string; brand?: string }> }) {
  const searchParams = await props.searchParams;
  await requirePageAdmin();
  const status = STATUSES.find((s) => s === searchParams.status);
  const [charts, brands] = await Promise.all([
    db.brandSizeChart.findMany({
      where: { ...(searchParams.brand ? { brand: { slug: searchParams.brand } } : {}), ...(status ? { versions: { some: { status } } } : {}) },
      orderBy: [{ brand: { name: "asc" } }, { category: { slug: "asc" } }], take: 200,
      include: { brand: true, category: true, product: true, versions: { orderBy: { version: "desc" }, take: 1 }, _count: { select: { versions: true } } },
    }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return (
    <>
      <AdminHeader title="Size charts" lede="Each chart keeps every version. Corrections and imports always add a new unverified version; nothing is overwritten." />
      <form className="flex flex-wrap gap-2 mb-6" method="get">
        <select name="brand" defaultValue={searchParams.brand ?? ""} className="input !h-10 !w-auto" aria-label="Brand"><option value="">All brands</option>{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select>
        <select name="status" defaultValue={status ?? ""} className="input !h-10 !w-auto" aria-label="Status"><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toLowerCase()}</option>)}</select>
        <button className="btn btn-ghost !h-10">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="table-x min-w-[50rem]">
          <thead><tr><th>Chart</th><th>Scope</th><th>Latest version</th><th>Source</th><th>Versions</th></tr></thead>
          <tbody>{charts.map((c) => { const v = c.versions[0]; return (
            <tr key={c.id}>
              <td><Link href={`/admin/charts/${c.id}`} className="font-medium link">{c.brand.name}, {c.category.name}</Link><span className="block text-xs text-muted">{GENDER_NAMES[c.gender]}, {c.region}{c.productLine ? `, ${c.productLine}` : ""}, cut {c.fitCut.toLowerCase()}</span></td>
              <td className="text-xs">{c.product ? <>Product<span className="block text-muted max-w-[14rem] truncate">{c.product.name}</span></> : "Brand"}</td>
              <td>{v ? <><span className="mr-2 num">v{v.version}</span><DataBadge status={v.status} demo={c.brand.isDemo} /></> : "–"}</td>
              <td className="text-xs text-muted">{v ? `${SOURCE_NAMES[v.sourceType] ?? v.sourceType}, ${v.extractionMethod ?? "n/a"}` : ""}</td>
              <td className="num">{c._count.versions}</td>
            </tr>); })}</tbody>
        </table>
        {charts.length === 0 && <p className="mt-3 text-sm text-muted">No charts match.</p>}
      </div>
      <section className="mt-14">
        <h2 className="display-sm">Import a chart from CSV</h2>
        <p className="mt-2 mb-6 text-sm text-muted max-w-prose">Copy the table from the brand’s own guide. Choose the unit, what the numbers describe and the cut exactly as the source states them; “source doesn’t say” keeps those measurements out of recommendations until resolved.</p>
        <ChartImport brands={brands} categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))} />
      </section>
    </>
  );
}
