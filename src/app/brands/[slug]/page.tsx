import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { DataBadge, DIM_NAMES, FIT_NAMES } from "@/components/badges";
import { SaveBrandButton } from "@/components/save-brand-button";
import { DIMENSIONS, type ChartRow } from "@/lib/engine";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const b = await db.brand.findUnique({ where: { slug: params.slug } }).catch(() => null);
  return { title: b?.name ?? "Brand" };
}

export default async function BrandPage({ params }: { params: { slug: string } }) {
  const brand = await db.brand.findFirst({ where: { slug: params.slug, active: true } });
  if (!brand) notFound();
  const user = await getUser();
  const [charts, saved] = await Promise.all([
    db.brandSizeChart.findMany({
      where: { brandId: brand.id, active: true },
      include: { category: true, versions: { where: { status: { not: "DEPRECATED" } }, orderBy: { version: "desc" } } },
    }),
    user ? db.savedBrand.findUnique({ where: { userId_brandId: { userId: user.id, brandId: brand.id } } }) : null,
  ]);
  const usable = charts.filter((c) => c.versions.length);

  return (
    <div className="container-x py-8 sm:py-12">
      <Link href="/brands" className="text-sm text-muted hover:text-ink">← All brands</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold">{brand.name}</h1>
          <p className="mt-1 text-muted">{brand.region === "INDIAN" ? "Indian brand" : "International brand"}</p>
        </div>
        {user && <SaveBrandButton slug={brand.slug} initial={!!saved} />}
      </div>

      {usable.length === 0 && (
        <div className="card mt-8 p-6">
          <h2 className="font-semibold">No size chart yet</h2>
          <p className="mt-1 text-muted max-w-lg">We haven’t added a verified size chart for {brand.name}. We won’t guess one. Once it’s added and verified, you’ll be able to get recommendations here.</p>
        </div>
      )}

      {usable.map((c) => {
        const v = c.versions.find((x) => x.status === "VERIFIED") ?? c.versions[0];
        const rows = v.rows as ChartRow[];
        const dims = DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
        return (
          <section key={c.id} className="card mt-8 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{c.category.name} <span className="text-muted font-normal text-base">· {FIT_NAMES[c.fitCut]} cut</span></h2>
              <DataBadge status={v.status} demo={brand.isDemo} />
            </div>
            <p className="mt-1 text-sm text-muted">{v.measurementType === "GARMENT" ? "Garment measurements (the clothing itself), in cm." : "Body measurements the size is made for, in cm."}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="text-left text-muted border-b border-line"><th className="py-2 pr-4 font-medium">Size</th>{dims.map((d) => <th key={d} className="py-2 pr-4 font-medium">{DIM_NAMES[d]}</th>)}</tr></thead>
                <tbody>{rows.map((r) => <tr key={r.label} className="border-b border-line/60"><td className="py-2 pr-4 font-semibold">{r.label}</td>{dims.map((d) => <td key={d} className="py-2 pr-4">{r[d] ?? "–"}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted">
              Source: {v.sourceUrl ? <a className="underline" href={v.sourceUrl} target="_blank" rel="noopener noreferrer">{v.sourceUrl}</a> : v.sourceNote ?? "not recorded"}
              {v.verifiedAt && <> · verified {v.verifiedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>}
            </p>
            <Link href={`/recommend?brand=${brand.slug}&category=${c.category.slug}`} className="btn btn-primary mt-5">Find my size in {brand.name.replace(/ \(sample data\)/, "")}</Link>
          </section>
        );
      })}
    </div>
  );
}
