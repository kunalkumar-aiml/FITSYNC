"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge, DIM_NAMES, FitChip, FIT_NAMES, GENDER_NAMES, SOURCE_NAMES } from "./badges";
import { EaseRuler } from "./ease-ruler";
import { Notice } from "./ui";
import type { ChartRow, Dimension, FitPreference, RecommendationResult } from "@/lib/engine";

type Gender = "MEN" | "WOMEN" | "UNISEX";
type BrandOpt = { slug: string; name: string; isDemo: boolean; productCategories: string[]; categories: { slug: string; name: string; gender: Gender }[] };
type Product = { id: string; name: string; listedOn: { marketplace: string }[]; fitCut: string; fitCutStated: boolean };
type Resp = {
  id: string | null; brand: { name: string; slug: string; isDemo: boolean }; category: { name: string }; fitCut: string;
  gender: Gender; region: string; productLine: string; product: { name: string; marketplaces: string[] } | null; pendingProductChart: boolean; options: { region: string; productLine: string; gender: Gender }[];
  chart: { version: number; status: string; measurementType: string; sourceType: string; sourceUrl: string | null; sourceNote: string | null; retrievedAt: string | null; verifiedAt: string | null; rows: ChartRow[] };
  result: RecommendationResult;
};
const safeHref = (u: string | null) => { try { return u && new URL(u).protocol === "https:" ? u : null; } catch { return null; } };

export function RecommendClient({ brands, categories, defaultFit, initialBrand, initialCategory, defaultGender, unit }: {
  brands: BrandOpt[]; categories: { slug: string; name: string }[]; defaultFit: FitPreference; initialBrand?: string; initialCategory?: string; defaultGender: Gender | null; unit: "CM" | "IN";
}) {
  const toast = useToast();
  const [category, setCategory] = useState(initialCategory && categories.some((c) => c.slug === initialCategory) ? initialCategory : categories[0].slug);
  const [gender, setGender] = useState<Gender | null>(defaultGender);
  const [brand, setBrand] = useState(initialBrand && brands.some((b) => b.slug === initialBrand) ? initialBrand : brands[0]?.slug ?? "");
  const [fit, setFit] = useState<FitPreference>(defaultFit);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [data, setData] = useState<Resp | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const chosen = brands.find((b) => b.slug === brand);
  const hasBrandChart = (b: BrandOpt) => b.categories.some((c) => c.slug === category && (gender === null || c.gender === gender || c.gender === "UNISEX"));
  const hasData = (b: BrandOpt) => hasBrandChart(b) || b.productCategories.includes(category);
  const reset = () => { setData(null); setSavedId(null); setError(null); };

  useEffect(() => {
    setProductId(""); setProducts([]);
    if (!chosen?.productCategories.includes(category)) return;
    let live = true;
    api<Product[]>(`/api/brands/${chosen.slug}/products?category=${category}`).then((p) => live && setProducts(p)).catch(() => {});
    return () => { live = false; };
  }, [chosen?.slug, category]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(save: boolean, region?: string) {
    if (!chosen) return;
    if (!gender) { setError({ text: "Choose men’s, women’s or unisex sizing first." }); return; }
    setBusy(true); setError(null);
    try {
      const r = await api<Resp>("/api/recommendations", { method: "POST", json: { brandSlug: chosen.slug, categorySlug: category, fitPreference: fit, gender, ...(region ? { region } : {}), ...(productId ? { productId } : {}), save } });
      setData(r);
      if (save) { setSavedId(r.id); toast("success", "Recommendation saved to your history"); } else setSavedId(null);
    } catch (e) {
      setData(null);
      setError(e instanceof ClientError ? { text: e.message, code: e.details?.code } : { text: "We couldn’t reach FITSYNC. Check your connection." });
    }
    setBusy(false);
  }

  const res = data?.result;
  return (
    <div className="container-x pb-16">
      <header className="pt-10 sm:pt-14 pb-8">
        <h1 className="display-lg">Find my size</h1>
        <p className="mt-3 lede">Choose what you’re buying. We compare your fit profile with that brand’s own chart.</p>
      </header>

      <div className="grid lg:grid-cols-12 gap-10">
        <form className="lg:col-span-4 space-y-7" onSubmit={(e) => { e.preventDefault(); run(false); }} aria-label="What are you buying?">
          <fieldset>
            <legend className="label">Clothing</legend>
            <select className="input" aria-label="Clothing category" value={category} onChange={(e) => { setCategory(e.target.value); reset(); }}>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend className="label">Sizing</legend>
            <div className="seg" role="radiogroup" aria-label="Sizing type">
              {(["MEN", "WOMEN", "UNISEX"] as Gender[]).map((g) => <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => { setGender(g); reset(); }} className="seg-item">{GENDER_NAMES[g]}</button>)}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="brand">Brand</label>
            <select id="brand" className="input" value={brand} onChange={(e) => { setBrand(e.target.value); reset(); }}>
              {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}{hasData(b) ? "" : " (data unavailable)"}</option>)}
            </select>
            {chosen && !hasData(chosen) && <p className="hint !text-warn">No {categories.find((c) => c.slug === category)?.name.toLowerCase()} chart for {chosen.name} in this sizing yet. You can still ask; we’ll say why there’s no size.</p>}
          </div>
          {products.length > 0 && (
            <div>
              <label className="label" htmlFor="product">Product <span className="text-muted font-normal">(optional)</span></label>
              <select id="product" className="input" value={productId} onChange={(e) => { setProductId(e.target.value); reset(); }}>
                <option value="">Use the brand’s general chart</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <p className="hint">A product’s own chart replaces the brand chart once a person has verified it.</p>
            </div>
          )}
          <fieldset>
            <legend className="label">Fit you want</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fit preference">
              {(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"] as FitPreference[]).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={fit === f} onClick={() => { setFit(f); reset(); }} className={`rounded-sm border px-3 py-2 text-sm text-left ${fit === f ? "border-ink bg-surface font-medium" : "border-line text-muted hover:text-ink"}`}>{FIT_NAMES[f]}</button>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-primary w-full h-12" disabled={busy || !chosen || !gender}>{busy && <Loader2 size={16} className="animate-spin" />}Show my size</button>
        </form>

        <div className="lg:col-span-8 min-h-[20rem]" aria-live="polite">
          {error && (
            <Notice tone={error.code === "DATA_UNAVAILABLE" ? "info" : "error"} title={error.code === "DATA_UNAVAILABLE" ? "Data unavailable" : undefined} role="alert">
              {error.text} {error.text.includes("measurements") && <Link href="/profile" className="link">Add measurements</Link>}
            </Notice>
          )}
          {busy && !data && <div className="skeleton h-80" aria-hidden />}
          {!data && !busy && !error && (
            <div className="h-full min-h-[20rem] rounded-md border border-dashed border-line grid place-items-center p-8 text-center">
              <p className="text-muted max-w-sm">Your size, the reasoning behind it and the chart it came from will appear here.</p>
            </div>
          )}
          <AnimatePresence mode="wait">
            {data && res && (
              <motion.section key={`${data.brand.slug}-${data.region}-${res.status}-${fit}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <Result data={data} res={res} unit={unit} />
                {data.options.filter((o) => o.region !== data.region).length > 0 && (
                  <p className="mt-6 text-sm text-muted">This brand also publishes other size systems:{" "}
                    {[...new Map(data.options.filter((o) => o.region !== data.region).map((o) => [o.region, o])).values()].map((o) => (
                      <button key={o.region} type="button" className="link text-ink mr-3" onClick={() => run(false, o.region)}>{o.region}</button>))}
                  </p>
                )}
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
                  {res.status === "ok" && (savedId
                    ? <Link href="/history" className="btn btn-ghost">Saved. Report the fit later in History</Link>
                    : <button type="button" className="btn btn-primary" onClick={() => run(true, data.region)} disabled={busy}>Save to history</button>)}
                  <Link href="/compare" className="btn btn-quiet">Compare across brands</Link>
                </div>
                <SourceNote data={data} />
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Result({ data, res, unit }: { data: Resp; res: RecommendationResult; unit: "CM" | "IN" }) {
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <p className="text-sm"><span className="font-medium">{data.brand.name}</span> <span className="text-muted">{data.product ? data.product.name : data.category.name}, {GENDER_NAMES[data.gender].toLowerCase()} {data.region} sizing{data.productLine ? `, ${data.productLine}` : ""}</span></p>
      <div className="flex flex-wrap gap-2"><span className="tag">{data.product ? "Product chart" : "Brand chart"}</span><DataBadge status={data.chart.status} demo={data.brand.isDemo} /></div>
    </div>
  );
  return (
    <div>
      {head}
      {data.pendingProductChart && <div className="mt-4"><Notice tone="info">This product has its own chart, but it isn’t verified yet, so the brand’s general chart was used.</Notice></div>}
      {res.status === "ok" && <Ok data={data} res={res} unit={unit} />}
      {res.status === "no_compatible_size" && (
        <div className="mt-6"><p className="display-sm">No size suits this fit</p><p className="mt-3 text-muted max-w-prose">{res.explanation}</p></div>
      )}
      {res.status === "insufficient_data" && (
        <div className="mt-6">
          <p className="display-sm">We can’t recommend a size from this chart</p>
          <p className="mt-3 text-muted max-w-prose">{res.explanation}</p>
          {res.missing.length > 0 && !res.excluded?.length && <Link href="/profile" className="btn btn-primary mt-5">Add {res.missing.map((m) => DIM_NAMES[m].toLowerCase()).join(", ")}</Link>}
        </div>
      )}
      {res.status === "invalid_input" && <div className="mt-6"><p className="display-sm">Check your measurements</p><ul className="mt-3 list-disc pl-5 text-muted text-sm">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul><Link href="/profile" className="btn btn-primary mt-5">Fix measurements</Link></div>}
      {res.status !== "invalid_input" && "warnings" in res && res.warnings.length > 0 && (
        <ul className="mt-6 space-y-1.5 text-sm text-muted list-disc pl-5">{res.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
    </div>
  );
}

function Ok({ data, res, unit }: { data: Resp; res: Extract<RecommendationResult, { status: "ok" }>; unit: "CM" | "IN" }) {
  const best = res.ranking.find((r) => r.label === res.recommendedSize)!;
  const primary = best.dimensions.find((d) => d.dimension === "chest") ?? best.dimensions.find((d) => d.dimension === "waist") ?? best.dimensions[0];
  const sizes = data.chart.rows.filter((r) => r[primary.dimension as Dimension] !== undefined).map((r) => ({ label: r.label, cm: r[primary.dimension as Dimension]!, max: (r as Record<string, unknown>)[`${primary.dimension}Max`] as number | undefined }));
  const show = (cm: number) => (unit === "IN" ? `${(cm / 2.54).toFixed(1)} in` : `${Math.round(cm * 10) / 10} cm`);
  const signed = (cm: number) => `${cm > 0 ? "+" : cm < 0 ? "−" : ""}${unit === "IN" ? Math.abs(cm / 2.54).toFixed(1) : Math.abs(Math.round(cm * 10) / 10)}`;
  return (
    <div className="mt-6">
      <div className="grid sm:grid-cols-[auto_1fr] gap-x-10 gap-y-6 items-end">
        <div>
          <p className="text-sm text-muted">Your size</p>
          <p className="font-display text-[6.5rem] leading-[0.85] tracking-tight">{res.recommendedSize}</p>
        </div>
        <div className="space-y-3 text-sm">
          <p>You asked for a <strong className="font-medium">{FIT_NAMES[res.fitPreference].toLowerCase()}</strong> fit.{" "}
            {res.achievedFit
              ? <>On the {primary.dimension === "waist" ? "waist" : "chest"}, this size should feel <strong className="font-medium">{res.achievedFit === "TIGHTER_THAN_SLIM" ? "very close-fitting" : res.achievedFit === "LOOSER_THAN_OVERSIZED" ? "very loose" : FIT_NAMES[res.achievedFit].toLowerCase()}</strong>.</>
              : <span className="text-muted">This chart lists the body each size is made for, so the final feel depends on the garment’s cut{res.garmentCut ? ` (sold as ${FIT_NAMES[res.garmentCut].toLowerCase()})` : ", which the source doesn’t state"}.</span>}
          </p>
          {res.alternatives[0] && res.alternatives[0].score >= 0.5 && <p className="text-muted">Next closest: <strong className="text-ink font-medium">{res.alternatives[0].size}</strong>.</p>}
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-3">
              <span className="text-muted">Fit Match Score</span>
              <span className="h-1.5 w-28 bg-line" aria-hidden><span className="block h-full bg-primary" style={{ width: `${res.fitMatchScore * 100}%` }} /></span>
              <span className="num font-medium">{Math.round(res.fitMatchScore * 100)}</span>
              <span className="text-xs text-muted underline underline-offset-4">What is this?</span>
            </summary>
            <p className="mt-2 text-xs text-muted max-w-prose">An experimental score from 0 to 100 for how closely this size matches your measurements for the fit you chose. It is not a probability that the garment will fit, and it hasn’t been validated against real fit reports yet. It is lowered when the chart is unverified, when measurements are missing, or when two sizes are close.</p>
          </details>
          {res.provisional && <p className="text-warn">Provisional: based on an unverified chart or on only some of your measurements.</p>}
        </div>
      </div>

      <div className="mt-8">
        <EaseRuler bodyCm={primary.bodyCm} dimensionLabel={DIM_NAMES[primary.dimension]} sizes={sizes} valueKind={primary.semantic === "GARMENT" ? "garment" : "body"}
          band={{ min: primary.bodyCm + primary.idealRange.min, max: primary.bodyCm + primary.idealRange.max }} recommended={res.recommendedSize} />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="table-x min-w-[32rem]">
          <caption className="text-left text-sm font-medium pb-2">Measurement by measurement, size {res.recommendedSize}</caption>
          <thead><tr><th scope="col">Measurement</th><th scope="col">You</th><th scope="col">Size {res.recommendedSize}</th><th scope="col">Difference</th><th scope="col">Fit</th></tr></thead>
          <tbody>
            {best.dimensions.map((d) => (
              <tr key={d.dimension}>
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">{DIM_NAMES[d.dimension]}<span className="block text-2xs text-muted font-normal">{d.semantic === "GARMENT" ? "garment measurement" : "body size the chart lists"}</span></th>
                <td>{show(d.bodyCm)}</td>
                <td>{d.chartRange ? `${show(d.chartRange[0])} to ${show(d.chartRange[1])}` : show(d.chartCm)}</td>
                <td>{d.chartRange && d.differenceCm === 0 ? "Within range" : signed(d.differenceCm)}{d.semantic === "GARMENT" && <span className="block text-2xs text-muted">ideal {signed(d.idealRange.min)} to {signed(d.idealRange.max)}</span>}</td>
                <td><FitChip label={d.label} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(best.skipped.length > 0 || res.excluded.length > 0) && (
          <p className="mt-2 text-xs text-muted">Not compared: {[...new Set([...res.excluded.map((e) => `${DIM_NAMES[e.dimension].toLowerCase()} (${e.reason === "FLAT_WIDTH" ? "flat width, not a circumference" : "meaning not stated by the source"})`), ...best.skipped.filter((s) => !res.excluded.some((e) => e.dimension === s)).map((s) => `${DIM_NAMES[s].toLowerCase()} (not in your profile or this chart)`)])].join(", ")}.</p>
        )}
      </div>
      <p className="mt-5 text-sm text-muted max-w-prose">{res.explanation}</p>
    </div>
  );
}

function SourceNote({ data }: { data: Resp }) {
  const href = safeHref(data.chart.sourceUrl);
  const when = data.chart.verifiedAt ? `verified ${new Date(data.chart.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : data.chart.retrievedAt ? `collected ${new Date(data.chart.retrievedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, not yet verified` : "not yet verified";
  return (
    <p className="mt-6 text-xs text-muted max-w-prose">
      Source: {SOURCE_NAMES[data.chart.sourceType] ?? data.chart.sourceType}, chart version {data.chart.version}, {when}.{" "}
      {href ? <a className="link" href={href} target="_blank" rel="noopener noreferrer nofollow">Open the source</a> : data.chart.sourceNote}{href ? "." : ""}{" "}
      Ease allowances are starting values that haven’t yet been calibrated with fit reports.
    </p>
  );
}
