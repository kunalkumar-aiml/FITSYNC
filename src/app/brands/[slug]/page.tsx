import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { DataBadge, DIM_NAMES, FIT_NAMES, GENDER_NAMES, SOURCE_NAMES } from "@/components/badges";
import { SaveBrandButton } from "@/components/save-brand-button";
import { PageHeader, Notice } from "@/components/ui";
import { DIMENSIONS, GARMENT_ONLY_DIMENSIONS, parseSemantics, round1, semanticFor, type ChartRow, type MeasurementType } from "@/lib/engine";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const b = await db.brand.findUnique({ where: { slug: params.slug } }).catch(() => null);
  return { title: b?.name ?? "Brand" };
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const MEANING = { BODY: "body", GARMENT: "garment", GARMENT_FLAT: "garment, laid flat", AMBIGUOUS: "not stated" } as const;
const safeHref = (u: string | null) => { try { return u && new URL(u).protocol === "https:" ? u : null; } catch { return null; } };

export default async function BrandPage({ params }: { params: { slug: string } }) {
  const brand = await db.brand.findFirst({ where: { slug: params.slug, active: true } });
  if (!brand) notFound();
  const user = await getUser();
  const [charts, saved, notes] = await Promise.all([
    db.brandSizeChart.findMany({
      where: { brandId: brand.id, active: true }, orderBy: [{ productId: "asc" }, { gender: "asc" }, { region: "asc" }],
      include: { category: true, product: { include: { listings: { include: { marketplace: true } } } }, versions: { where: { status: { in: ["VERIFIED", "UNVERIFIED"] } }, orderBy: { version: "desc" } } },
    }),
    user ? db.savedBrand.findUnique({ where: { userId_brandId: { userId: user.id, brandId: brand.id } } }) : null,
    db.brandCoverageNote.findMany({ where: { brandId: brand.id }, orderBy: { checkedAt: "desc" }, take: 5, include: { product: true } }),
  ]);
  const usable = charts.filter((c) => c.versions.length);
  const brandNotes = notes.filter((n) => !n.productId);
  const productNotes = notes.filter((n) => n.productId);

  return (
    <div className="container-x">
      <PageHeader back={{ href: "/brands", label: "All brands" }} title={brand.name}
        lede={`${brand.region === "INDIAN" ? "Indian" : "International"} brand. ${usable.length ? `${usable.length} size ${usable.length === 1 ? "chart" : "charts"} on file.` : "No usable size chart on file."}`}
        actions={user ? <SaveBrandButton slug={brand.slug} initial={!!saved} /> : undefined} />

      {usable.length === 0 && (
        <Notice tone="info" title="Data unavailable">
          We don’t have an official size chart for {brand.name} yet, and we won’t guess one. {brandNotes[0]?.note}
        </Notice>
      )}
      {usable.length > 0 && brandNotes[0] && <p className="text-sm text-muted max-w-prose">Missing brand-level data: {brandNotes[0].note}</p>}
      {productNotes.length > 0 && <ul className="mt-3 text-sm text-muted space-y-1">{productNotes.map((n) => <li key={n.id}>Missing product data for {n.product?.name}: {n.note}</li>)}</ul>}

      <div className="mt-6 space-y-16">
        {usable.map((c) => {
          const v = c.versions.find((x) => x.status === "VERIFIED") ?? c.versions[0];
          const rows = v.rows as ChartRow[];
          const chartLike = { semantics: parseSemantics(v.measurementSemantics), ambiguousDimensions: (Array.isArray(v.ambiguousDimensions) ? v.ambiguousDimensions : []) as never[], measurementType: v.measurementType as MeasurementType };
          const dims = DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
          const extra = GARMENT_ONLY_DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
          const unclear = dims.filter((d) => !["BODY", "GARMENT"].includes(semanticFor(chartLike, d)));
          const href = safeHref(v.sourceUrl);
          return (
            <section key={c.id} className="rule pt-6" aria-labelledby={`c-${c.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 id={`c-${c.id}`} className="display-sm">{c.product ? c.product.name : c.category.name}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {GENDER_NAMES[c.gender]} sizing, {c.region} size system{c.productLine ? `, ${c.productLine}` : ""}. Cut: {FIT_NAMES[c.fitCut] ?? c.fitCut}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2"><span className="tag">{c.product ? "Product-specific" : "Brand-level"}</span><DataBadge status={v.status} demo={brand.isDemo} /></div>
              </div>
              {c.product && <p className="mt-3 text-sm text-muted max-w-prose">This chart applies to this product only. Brand: {brand.name}. Listed on {c.product.listings.map((l) => l.marketplace?.name ?? "the brand’s site").join(", ")}.</p>}
              {unclear.length > 0 && <div className="mt-4"><Notice tone="warn" title="Not used for recommendations yet">The source does not say whether {unclear.map((d) => DIM_NAMES[d].toLowerCase()).join(", ")} {unclear.length === 1 ? "is a body or garment measurement" : "are body or garment measurements"}. They stay out until someone confirms it against the source.</Notice></div>}
              <div className="mt-5 overflow-x-auto">
                <table className="table-x min-w-[28rem]">
                  <caption className="sr-only">{brand.name} {c.category.name} size chart in centimetres</caption>
                  <thead><tr><th scope="col">Size</th>{[...dims, ...extra].map((d) => <th key={d} scope="col">{DIM_NAMES[d]} <span className="font-normal">(cm, {(dims as string[]).includes(d) ? MEANING[semanticFor(chartLike, d as typeof dims[number])] : "garment"})</span></th>)}</tr></thead>
                  <tbody>{rows.map((r) => <tr key={r.label}><th scope="row" className="py-2.5 pr-4 font-semibold text-left">{r.label}</th>{[...dims, ...extra].map((d) => { const hi = (r as Record<string, unknown>)[`${d}Max`] as number | undefined; const lo = r[d]; return <td key={d}>{lo === undefined ? "–" : hi !== undefined ? `${round1(lo)}–${round1(hi)}` : round1(lo)}</td>; })}</tr>)}</tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-muted max-w-prose">
                {SOURCE_NAMES[v.sourceType] ?? v.sourceType}, version {v.version}. Published in {v.originalUnit === "IN" ? "inches, converted to centimetres" : "centimetres"}.{" "}
                {href ? <a className="link" href={href} target="_blank" rel="noopener noreferrer nofollow">View source</a> : v.sourceNote ? `Source: ${v.sourceNote}` : "Source not recorded."}{href ? "." : ""}
                {v.verifiedAt ? ` Verified ${fmtDate(v.verifiedAt)}.` : v.retrievedAt ? ` Collected ${fmtDate(v.retrievedAt)}, not yet verified.` : ""}
              </p>
              {user && <Link href={`/recommend?brand=${brand.slug}&category=${c.category.slug}&gender=${c.gender}`} className="btn btn-primary mt-6">Find my size in {brand.name.replace(/ \(sample data\)/, "")}</Link>}
            </section>
          );
        })}
      </div>
      {!user && usable.length > 0 && <div className="mt-12"><Link href="/signup" className="btn btn-primary">Create a fit profile to find your size</Link></div>}
    </div>
  );
}
