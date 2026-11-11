"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, TriangleAlert } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge, DIM_NAMES, FitChip, FIT_NAMES } from "./badges";
import { EaseRuler } from "./ease-ruler";
import type { ChartRow, Dimension, FitPreference, RecommendationResult } from "@/lib/engine";

type Gender = "MEN" | "WOMEN" | "UNISEX";
type BrandOpt = { slug: string; name: string; isDemo: boolean; hasProducts?: boolean; categories: { slug: string; name: string; gender: Gender }[] };
const GENDER_NAMES: Record<Gender, string> = { MEN: "Men’s", WOMEN: "Women’s", UNISEX: "Unisex" };
type Resp = {
  id: string | null; brand: { name: string; isDemo: boolean }; category: { name: string }; fitCut: string;
  gender: Gender; region: string; productLine: string; product: { name: string; marketplaces: string[] } | null; pendingProductChart: boolean; options: { region: string; productLine: string; gender: Gender }[];
  chart: { status: string; measurementType: "BODY" | "GARMENT"; sourceType: string; sourceUrl: string | null; sourceNote: string | null; rows: ChartRow[] };
  result: RecommendationResult;
};

export function RecommendClient({ brands, categories, defaultFit, initialBrand, initialCategory, defaultGender }: {
  brands: BrandOpt[]; categories: { slug: string; name: string }[]; defaultFit: FitPreference; initialBrand?: string; initialCategory?: string; defaultGender: Gender | null;
}) {
  const toast = useToast();
  const [category, setCategory] = useState(initialCategory && categories.some((c) => c.slug === initialCategory) ? initialCategory : categories[0].slug);
  const [gender, setGender] = useState<Gender | null>(defaultGender);
  const hasData = (b: BrandOpt) => b.categories.some((c) => c.slug === category && (gender === null || c.gender === gender || c.gender === "UNISEX")) || !!b.hasProducts;
  const available = brands; // unavailable brands stay selectable so we can say "data unavailable" honestly
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [fit, setFit] = useState<FitPreference>(defaultFit);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; listedOn: { marketplace: string }[]; fitCut: string; fitCutStated: boolean }[]>([]);
  const [productId, setProductId] = useState("");
  const [data, setData] = useState<Resp | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = available.find((b) => b.slug === brand) ?? available[0];
  useEffect(() => {
    setProductId(""); setProducts([]);
    if (!chosen?.hasProducts) return;
    let live = true;
    api<typeof products>(`/api/brands/${chosen.slug}/products?category=${category}`).then((p) => live && setProducts(p)).catch(() => {});
    return () => { live = false; };
  }, [chosen?.slug, category]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(save: boolean, region?: string) {
    if (!chosen || !gender) { setError("Choose men’s, women’s or unisex sizing first."); return; }
    setBusy(true); setError(null);
    try {
      const r = await api<Resp>("/api/recommendations", { method: "POST", json: { brandSlug: chosen.slug, categorySlug: category, fitPreference: fit, gender, ...(region ? { region } : {}), ...(productId ? { productId } : {}), save } });
      setData(r);
      if (save) { setSavedId(r.id); toast("success", "Recommendation saved"); } else setSavedId(null);
    } catch (e) { setError(e instanceof ClientError ? e.message : "Couldn’t get a recommendation. Check your connection."); }
    setBusy(false);
  }

  const res = data?.result;
  return (
    <div className="container-x py-8 sm:py-12 max-w-3xl">
      <h1 className="text-3xl sm:text-4xl font-semibold">Find your size</h1>
      <div className="card mt-6 p-5 space-y-5">
        <div>
          <span className="label">Type of clothing</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Clothing category">
            {categories.map((c) => (
              <button key={c.slug} role="radio" aria-checked={category === c.slug} onClick={() => { setCategory(c.slug); setData(null); }}
                className={`rounded-full border px-4 h-9 text-sm ${category === c.slug ? "bg-ink text-paper border-ink" : "border-line hover:border-ink/40"}`}>{c.name}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Sizing type</span>
          <div className="inline-flex rounded-full border border-line p-1 bg-surface" role="radiogroup" aria-label="Sizing type">
            {(Object.keys(GENDER_NAMES) as Gender[]).map((g) => (
              <button key={g} role="radio" aria-checked={gender === g} onClick={() => { setGender(g); setData(null); }}
                className={`px-4 py-1.5 rounded-full text-sm ${gender === g ? "bg-ink text-paper" : "text-muted"}`}>{GENDER_NAMES[g]}</button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="brand">Brand</label>
            <select id="brand" className="input" value={chosen?.slug ?? ""} onChange={(e) => { setBrand(e.target.value); setData(null); }} disabled={!available.length}>
              {available.map((b) => <option key={b.slug} value={b.slug}>{b.name}{hasData(b) ? "" : " (data unavailable)"}</option>)}
            </select>
            {chosen && !hasData(chosen) && <p className="mt-1.5 text-sm text-warn">No official {categories.find((c) => c.slug === category)?.name.toLowerCase()} chart for {chosen.name} in this sizing type yet.</p>}
          </div>
          <div>
            <label className="label" htmlFor="fit">Fit</label>
            <select id="fit" className="input" value={fit} onChange={(e) => { setFit(e.target.value as FitPreference); setData(null); }}>
              {Object.entries(FIT_NAMES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
        </div>
        {products.length > 0 && (
          <div>
            <label className="label" htmlFor="product">Specific product <span className="text-muted font-normal">(optional)</span></label>
            <select id="product" className="input" value={productId} onChange={(e) => { setProductId(e.target.value); setData(null); }}>
              <option value="">Brand-level size chart</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.listedOn.map((l) => l.marketplace).join(", ")})</option>)}
            </select>
            <p className="mt-1 text-xs text-muted">A product’s own chart is used instead of the brand chart once its measurements are verified.</p>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => run(false)} disabled={busy || !chosen || !gender}>{busy && <Loader2 size={16} className="animate-spin" />}Get my size</button>
        {error && <div role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm">{error} {error.includes("measurements") && <Link href="/profile" className="underline">Add measurements</Link>}</div>}
      </div>

      {busy && !data && <div className="skeleton h-56 mt-6" aria-hidden />}

      {data && res && (
        <section className="card mt-6 p-5 sm:p-7" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{data.brand.name} · {data.category.name} <span className="text-muted font-normal text-sm">· {GENDER_NAMES[data.gender]} · {data.region}{data.productLine ? ` · ${data.productLine}` : ""}</span></h2>
            <div className="flex flex-wrap items-center gap-1.5"><span className="chip">{data.product ? "Product-specific chart" : "Brand-level chart"}</span><DataBadge status={data.chart.status} demo={data.brand.isDemo} /></div>
          </div>
          {data.product && <p className="mt-1 text-xs text-muted">{data.product.name} · listed on {data.product.marketplaces.join(", ")}</p>}
          {data.pendingProductChart && <p className="mt-2 text-sm text-warn">This product has its own chart, but it is not verified yet, so the brand-level chart was used instead.</p>}
          {res && res.status === "ok" && res.provisional && <p role="status" className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2 text-sm">Provisional result: it relies on a chart that is not fully verified or on partial measurements. Treat it as a guide.</p>}

          {res.status === "ok" && <Ok data={data} res={res} />}
          {data.options.filter((o) => o.region !== data.region || o.productLine !== data.productLine).length > 0 && (
            <p className="mt-4 text-sm text-muted">Other sizing systems for this brand:{" "}
              {[...new Map(data.options.filter((o) => o.region !== data.region).map((o) => [o.region, o])).values()].map((o) => (
                <button key={o.region} className="underline mr-2 text-ink" onClick={() => run(false, o.region)}>{o.region}</button>))}
            </p>
          )}
          {res.status === "no_compatible_size" && (
            <div className="mt-4"><p className="text-xl font-semibold">No size fits well</p><p className="mt-2 text-muted">{res.explanation}</p></div>
          )}
          {res.status === "insufficient_data" && (
            <div className="mt-4 flex gap-3"><TriangleAlert className="text-warn shrink-0" /><div><p className="font-semibold">We can’t recommend a size yet</p><p className="mt-1 text-muted">{res.explanation}</p>
              {res.missing.length > 0 && <Link href="/profile" className="btn btn-primary mt-4">Add {res.missing.map((m) => DIM_NAMES[m].toLowerCase()).join(", ")}</Link>}</div></div>
          )}
          {res.status === "invalid_input" && <div className="mt-4"><p className="font-semibold">Check your measurements</p><ul className="mt-1 list-disc pl-5 text-muted text-sm">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul><Link href="/profile" className="btn btn-primary mt-4">Fix measurements</Link></div>}

          {res.status !== "invalid_input" && "warnings" in res && res.warnings.length > 0 && (
            <ul className="mt-5 space-y-1.5 text-sm text-warn">{res.warnings.map((w) => <li key={w} className="flex gap-2"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{w}</li>)}</ul>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {res.status === "ok" && (savedId ? <Link href="/history" className="btn btn-ghost">Saved. Report fit later in History</Link> : <button className="btn btn-accent" onClick={() => run(true)} disabled={busy}><Save size={16} />Save recommendation</button>)}
            <Link href="/compare" className="btn btn-quiet">Compare across brands</Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            Chart source: {data.chart.sourceUrl ? <a className="underline" href={data.chart.sourceUrl} target="_blank" rel="noopener noreferrer">{data.chart.sourceUrl}</a> : data.chart.sourceNote ?? "not recorded"}. Estimates are not validated against real fit data yet.
          </p>
        </section>
      )}
    </div>
  );
}

function Ok({ data, res }: { data: Resp; res: Extract<RecommendationResult, { status: "ok" }> }) {
  const best = res.ranking.find((r) => r.label === res.recommendedSize)!;
  const primary = best.dimensions.find((d) => d.dimension === "chest") ?? best.dimensions.find((d) => d.dimension === "waist") ?? best.dimensions[0];
  const sizes = data.chart.rows.filter((r) => r[primary.dimension as Dimension] !== undefined).map((r) => ({ label: r.label, cm: r[primary.dimension as Dimension]! }));
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-6xl font-semibold leading-none tracking-tight">{res.recommendedSize}</div>
          <div className="mt-2 text-sm text-muted">{FIT_NAMES[res.fitPreference]} fit</div>
        </div>
        <div className="w-44">
          <div className="flex justify-between text-xs text-muted"><span title="An experimental heuristic, not a probability. It has not been validated against real fit data yet.">Fit match score (experimental)</span><span className="tabular-nums">{Math.round(res.fitMatchScore * 100)}%</span></div>
          <div className="mt-1 h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent" style={{ width: `${res.fitMatchScore * 100}%` }} /></div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(res.compatibility).map(([d, l]) => <span key={d} className="inline-flex items-center gap-1.5 text-sm"><span className="text-muted">{DIM_NAMES[d]}</span><FitChip label={l!} /></span>)}
      </div>
      <div className="mt-6">
        <EaseRuler bodyCm={primary.bodyCm} dimensionLabel={DIM_NAMES[primary.dimension]} sizes={sizes}
          band={{ min: primary.bodyCm + primary.idealRange.min, max: primary.bodyCm + primary.idealRange.max }} recommended={res.recommendedSize} />
      </div>
      <p className="mt-3 text-sm text-muted">{res.explanation}</p>
      <p className="mt-2 text-sm">
        <span className="text-muted">You asked for:</span> <strong>{FIT_NAMES[res.fitPreference]}</strong>
        {res.achievedFit && <> · <span className="text-muted">this size should give a</span> <strong>{res.achievedFit === "TIGHTER_THAN_SLIM" ? "very close" : res.achievedFit === "LOOSER_THAN_OVERSIZED" ? "very loose" : FIT_NAMES[res.achievedFit]}</strong> <span className="text-muted">fit</span></>}
        {!res.achievedFit && data.chart.measurementType === "BODY" && <span className="text-muted"> · This chart lists body sizes, so the final fit depends on how the garment is cut. Check the product’s fit notes.</span>}
      </p>
      {res.alternatives[0] && res.alternatives[0].score > 0.5 && (
        <p className="mt-3 text-sm">Next closest: <strong>{res.alternatives[0].size}</strong> <span className="text-muted">(match {Math.round(res.alternatives[0].score * 100)}%)</span></p>
      )}
    </div>
  );
}
