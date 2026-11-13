"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { DataBadge, DIM_NAMES, FitChip, FIT_NAMES, GENDER_NAMES } from "./badges";
import { Notice } from "./ui";
import type { FitPreference, RecommendationResult } from "@/lib/engine";

type Gender = "MEN" | "WOMEN" | "UNISEX";
type Row = { brand: { slug: string; name: string; isDemo: boolean }; dataStatus: string; region?: string; productLine?: string; result: RecommendationResult };
type Unavail = { brand: { slug: string; name: string }; reason: string; note: string | null };
type Resp = { category: { name: string }; fitPreference: FitPreference; gender: Gender; rows: Row[]; unavailable: Unavail[] };

export function CompareClient({ categories, defaultFit, defaultGender }: { categories: { slug: string; name: string }[]; defaultFit: FitPreference; defaultGender: Gender | null }) {
  const [category, setCategory] = useState(categories[0].slug);
  const [fit, setFit] = useState<FitPreference>(defaultFit);
  const [gender, setGender] = useState<Gender | null>(defaultGender);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(null);
    try { setData(await api<Resp>("/api/compare", { method: "POST", json: { categorySlug: category, fitPreference: fit, gender } })); }
    catch (err) { setError(err instanceof ClientError ? err.message : "We couldn’t compare right now. Try again."); setData(null); }
    setBusy(false);
  }
  const sized = data?.rows.filter((r) => r.result.status === "ok") ?? [];
  const notSized = data?.rows.filter((r) => r.result.status !== "ok") ?? [];

  return (
    <div className="container-x pb-16">
      <header className="pt-10 sm:pt-14 pb-8">
        <h1 className="display-lg">Compare brands</h1>
        <p className="mt-3 lede">One body, one fit, different labels. Your size in every brand we hold a usable chart for.</p>
      </header>
      <form onSubmit={run} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] items-end border-y border-line py-5">
        <div><label className="label" htmlFor="cat">Clothing</label>
          <select id="cat" className="input" value={category} onChange={(e) => { setCategory(e.target.value); setData(null); }}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="fit2">Fit</label>
          <select id="fit2" className="input" value={fit} onChange={(e) => { setFit(e.target.value as FitPreference); setData(null); }}>{(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"] as const).map((v) => <option key={v} value={v}>{FIT_NAMES[v]}</option>)}</select></div>
        <div><label className="label" htmlFor="gen">Sizing</label>
          <select id="gen" className="input" value={gender ?? ""} onChange={(e) => { setGender(e.target.value as Gender); setData(null); }}>
            <option value="" disabled>Choose…</option>{(["MEN", "WOMEN", "UNISEX"] as Gender[]).map((g) => <option key={g} value={g}>{GENDER_NAMES[g]}</option>)}</select></div>
        <button className="btn btn-primary h-11" disabled={busy || !gender}>{busy && <Loader2 size={16} className="animate-spin" />}Compare</button>
      </form>

      <div className="mt-8" aria-live="polite">
        {error && <Notice tone="error" role="alert">{error} {error.includes("measurements") && <Link href="/profile" className="link">Add measurements</Link>}</Notice>}
        {busy && <div className="skeleton h-56" aria-hidden />}
        {data && !busy && (
          <>
            <h2 className="sr-only">Results</h2>
            {sized.length === 0 ? (
              <Notice tone="info" title="No sizes to compare yet">No brand has a usable {data.category.name.toLowerCase()} chart for {GENDER_NAMES[data.gender].toLowerCase()} sizing that fits your measurements for this fit.</Notice>
            ) : (
              <ul className="border-t border-line" aria-label={`${data.category.name}, ${FIT_NAMES[data.fitPreference].toLowerCase()} fit`}>
                {sized.map((r) => r.result.status === "ok" && (
                  <li key={`${r.brand.slug}-${r.region}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(10rem,1.2fr)_6rem_2fr_auto] items-center gap-x-6 gap-y-2 border-b border-line py-5">
                    <div>
                      <Link href={`/brands/${r.brand.slug}`} className="font-display text-d-sm hover:text-primary">{r.brand.name}</Link>
                      <p className="text-xs text-muted">{r.region} sizing{r.productLine ? `, ${r.productLine}` : ""}</p>
                    </div>
                    <p className="font-display text-d-lg leading-none text-right sm:text-left" aria-label={`Size ${r.result.recommendedSize}`}>{r.result.recommendedSize}</p>
                    <div className="col-span-2 sm:col-span-1 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                      {Object.entries(r.result.compatibility).map(([d, l]) => <span key={d} className="inline-flex items-center gap-1.5"><span className="text-muted">{DIM_NAMES[d]}</span><FitChip label={l!} /></span>)}
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-3 sm:justify-end">
                      <DataBadge status={r.dataStatus} demo={r.brand.isDemo} />
                      <span className="text-xs text-muted num" title="Experimental Fit Match Score, not a probability">score {Math.round(r.result.fitMatchScore * 100)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {notSized.length > 0 && (
              <section className="mt-10" aria-labelledby="ns-h">
                <h3 id="ns-h" className="font-semibold">Charts we have, but no size to show</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {notSized.map((r) => <li key={`${r.brand.slug}-${r.region}`}><span className="font-medium">{r.brand.name}</span> <span className="text-muted">{r.result.status === "invalid_input" ? r.result.errors[0] : r.result.explanation}</span></li>)}
                </ul>
              </section>
            )}
            {data.unavailable.length > 0 && (
              <section className="mt-10" aria-labelledby="un-h">
                <h3 id="un-h" className="font-semibold">Data unavailable</h3>
                <p className="mt-1 text-sm text-muted">No usable {data.category.name.toLowerCase()} chart for these brands, so no size is shown.</p>
                <ul className="mt-3 flex flex-wrap gap-2">{data.unavailable.map((u) => <li key={u.brand.slug}><Link href={`/brands/${u.brand.slug}`} className="tag !text-sm !text-ink !px-3 !py-1 hover:border-ink/50">{u.brand.name}</Link></li>)}</ul>
              </section>
            )}
            <p className="mt-10 text-xs text-muted max-w-prose">Sizes come only from each brand’s own chart. Unverified charts give provisional results. The score is the experimental Fit Match Score, not a probability.</p>
          </>
        )}
      </div>
    </div>
  );
}
