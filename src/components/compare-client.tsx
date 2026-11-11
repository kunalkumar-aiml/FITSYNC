"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { DataBadge, DIM_NAMES, FitChip, FIT_NAMES } from "./badges";
import type { FitPreference, RecommendationResult } from "@/lib/engine";

type Row = { brand: { slug: string; name: string; isDemo: boolean }; dataStatus: string; result: RecommendationResult };
type Gender = "MEN" | "WOMEN" | "UNISEX";
type Unavail = { brand: { slug: string; name: string }; reason: string; note: string | null };
type Resp = { category: { name: string }; fitPreference: FitPreference; gender: Gender; rows: (Row & { region?: string; productLine?: string })[]; unavailable: Unavail[] };
const GENDER_NAMES: Record<Gender, string> = { MEN: "Men’s", WOMEN: "Women’s", UNISEX: "Unisex" };

export function CompareClient({ categories, defaultFit, defaultGender }: { categories: { slug: string; name: string }[]; defaultFit: FitPreference; defaultGender: Gender | null }) {
  const [category, setCategory] = useState(categories[0].slug);
  const [fit, setFit] = useState<FitPreference>(defaultFit);
  const [gender, setGender] = useState<Gender | null>(defaultGender);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try { setData(await api<Resp>("/api/compare", { method: "POST", json: { categorySlug: category, fitPreference: fit, gender } })); }
    catch (e) { setError(e instanceof ClientError ? e.message : "Couldn’t compare right now."); setData(null); }
    setBusy(false);
  }

  return (
    <div className="container-x py-8 sm:py-12 max-w-4xl">
      <h1 className="text-3xl sm:text-4xl font-semibold">Compare brands</h1>
      <p className="mt-2 text-muted">One body, the same fit, different sizes. See your size in every brand we have a chart for.</p>
      <div className="card mt-6 p-5 flex flex-wrap items-end gap-4">
        <div className="min-w-40 flex-1"><label className="label" htmlFor="cat">Clothing</label>
          <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
        <div className="min-w-40 flex-1"><label className="label" htmlFor="fit2">Fit</label>
          <select id="fit2" className="input" value={fit} onChange={(e) => setFit(e.target.value as FitPreference)}>{Object.entries(FIT_NAMES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
        <div className="min-w-40 flex-1"><label className="label" htmlFor="gen">Sizing</label>
          <select id="gen" className="input" value={gender ?? ""} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="" disabled>Choose…</option>{(Object.keys(GENDER_NAMES) as Gender[]).map((g) => <option key={g} value={g}>{GENDER_NAMES[g]}</option>)}</select></div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !gender}>{busy && <Loader2 size={16} className="animate-spin" />}Compare</button>
      </div>
      {error && <div role="alert" className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm">{error} {error.includes("measurements") && <Link href="/profile" className="underline">Add measurements</Link>}</div>}
      {busy && <div className="skeleton h-40 mt-6" aria-hidden />}
      {data && !busy && (
        <>
        {data.rows.length === 0 ? (
          <div className="card mt-6 p-6 text-muted">No brand has an official {data.category.name.toLowerCase()} chart for {GENDER_NAMES[data.gender].toLowerCase()} sizing yet.</div>
        ) : (
          <div className="card mt-6 overflow-x-auto" aria-live="polite">
            <table className="w-full text-sm">
              <caption className="sr-only">Recommended {data.category.name} size per brand, {FIT_NAMES[data.fitPreference]} fit</caption>
              <thead><tr className="text-left text-muted border-b border-line"><th className="p-4 font-medium">Brand</th><th className="p-4 font-medium">Size</th><th className="p-4 font-medium">Fit</th><th className="p-4 font-medium">Fit match score (exp.)</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.brand.slug} className="border-b border-line/60 last:border-0 align-top">
                    <td className="p-4"><Link href={`/brands/${r.brand.slug}`} className="font-medium hover:underline">{r.brand.name}</Link><div className="mt-1 flex flex-wrap gap-1.5"><DataBadge status={r.dataStatus} demo={r.brand.isDemo} />{r.region && <span className="chip">{r.region}</span>}</div></td>
                    {r.result.status === "ok" ? (
                      <>
                        <td className="p-4 text-2xl font-semibold">{r.result.recommendedSize}</td>
                        <td className="p-4"><div className="flex flex-wrap gap-1.5">{Object.entries(r.result.compatibility).map(([d, l]) => <span key={d} title={DIM_NAMES[d]}><FitChip label={l!} /></span>)}</div><div className="mt-1 text-xs text-muted">{Object.keys(r.result.compatibility).map((d) => DIM_NAMES[d]).join(" · ")}</div></td>
                        <td className="p-4 tabular-nums">{Math.round(r.result.fitMatchScore * 100)}%</td>
                      </>
                    ) : (
                      <td colSpan={3} className="p-4 text-muted">{r.result.status === "invalid_input" ? r.result.errors[0] : r.result.explanation}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.unavailable.length > 0 && (
          <section className="card mt-6 p-5" aria-label="Brands without data">
            <h2 className="font-semibold">Data unavailable ({data.unavailable.length})</h2>
            <p className="mt-1 text-sm text-muted">We have no official {data.category.name.toLowerCase()} chart for these, so we don’t show a size.</p>
            <ul className="mt-3 flex flex-wrap gap-2">{data.unavailable.map((u) => <li key={u.brand.slug}><Link href={`/brands/${u.brand.slug}`} className="chip !text-ink hover:border-ink/40">{u.brand.name}</Link></li>)}</ul>
          </section>
        )}
        </>
      )}
    </div>
  );
}
