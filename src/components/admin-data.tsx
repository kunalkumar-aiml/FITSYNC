"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge } from "./badges";
import type { CoverageRow } from "@/lib/coverage";

type VersionRow = {
  id: string; brand: string; category: string; gender: string; region: string; product: string | null; productLine: string; version: number;
  status: string; sourceType: string; sourceUrl: string | null; extractionMethod: string | null; retrievedAt: string | null; ambiguous: string[]; isDemo: boolean; decisions: number;
};
type Job = { id: string; state: string; createdAt: string; summary: { counts?: Record<string, number> } | null; sources: { id: string; url: string; status: string; note: string | null; httpStatus: number | null }[] };
type BrandRow = { slug: string; name: string; region: string; active: boolean };
type Props = { coverage: CoverageRow[]; versions: VersionRow[]; jobs: Job[]; brands: BrandRow[]; categories: { slug: string; name: string }[]; marketplaces: { slug: string; name: string }[] };

const STATUS_TONE: Record<string, string> = {
  Verified: "bg-good/15 text-good", Unverified: "bg-warn/15 text-warn", Missing: "bg-line/60 text-muted", Outdated: "bg-bad/15 text-bad", "Product-specific": "bg-accent/20 text-ink",
  SUCCESS: "bg-good/15 text-good", PARTIAL_SUCCESS: "bg-warn/15 text-warn", NEEDS_HUMAN_VERIFICATION: "bg-warn/15 text-warn", SOURCE_UNAVAILABLE: "bg-line/60 text-muted", ACCESS_RESTRICTED: "bg-bad/15 text-bad", INVALID_DATA: "bg-bad/15 text-bad",
};
const Pill = ({ t }: { t: string }) => <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${STATUS_TONE[t] ?? "bg-line/60 text-muted"}`}>{t.replaceAll("_", " ").toLowerCase()}</span>;
const TABS = ["Coverage", "Charts", "Research", "Brands & products"] as const;

export function AdminData({ coverage, versions, jobs, brands, categories, marketplaces }: Props) {
  const router = useRouter(); const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Coverage");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState(""); const [fStatus, setFStatus] = useState(""); const [fGender, setFGender] = useState(""); const [fCat, setFCat] = useState("");
  const [csv, setCsv] = useState<{ id: string; text: string } | null>(null);

  async function act(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key);
    try { await fn(); toast("success", okMsg); router.refresh(); }
    catch (e) { toast("error", e instanceof ClientError ? e.message : "Failed."); }
    setBusy(null);
  }
  const rows = useMemo(() => coverage.filter((r) =>
    (!fStatus || r.status === fStatus) && (!fGender || r.gender === fGender) && (!fCat || r.category === fCat) &&
    (!q || `${r.brandName} ${r.product ?? ""} ${r.region}`.toLowerCase().includes(q.toLowerCase()))), [coverage, q, fStatus, fGender, fCat]);

  return (
    <section className="card p-5" aria-label="Data management">
      <div role="tablist" className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 text-sm ${tab === t ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{t}</button>)}
      </div>

      {tab === "Coverage" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <input className="input !h-9 max-w-52" placeholder="Search brand, product, region" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input !h-9 max-w-40" aria-label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All statuses</option>{["Verified", "Unverified", "Missing", "Outdated", "Product-specific"].map((s) => <option key={s}>{s}</option>)}</select>
            <select className="input !h-9 max-w-32" aria-label="Gender" value={fGender} onChange={(e) => setFGender(e.target.value)}><option value="">M + W</option><option value="MEN">Men</option><option value="WOMEN">Women</option></select>
            <select className="input !h-9 max-w-40" aria-label="Category" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          </div>
          <p className="mt-2 text-xs text-muted">{rows.length} rows. “Missing” = no chart added (shown to shoppers as Data unavailable). “Outdated” = last update over a year ago.</p>
          <div className="mt-3 max-h-[28rem] overflow-auto"><table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface"><tr className="text-left text-muted border-b border-line">{["Brand", "Category", "Gender", "Region", "Status", "Last updated"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/60"><td className="py-1.5 pr-3 font-medium">{r.brandName}{r.product && <div className="font-normal text-muted max-w-56 truncate">{r.product}</div>}</td><td className="pr-3">{r.category}</td><td className="pr-3">{r.gender === "MEN" ? "Men" : "Women"}</td><td className="pr-3">{r.region}</td><td className="pr-3"><Pill t={r.status} />{r.ambiguous && <span className="ml-1 text-warn">ambiguous</span>}</td><td className="pr-3 text-muted">{r.lastUpdated ?? "-"}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}

      {tab === "Charts" && (
        <ul className="mt-2 divide-y divide-line">
          {versions.length === 0 && <li className="py-3 text-sm text-muted">No charts yet.</li>}
          {versions.map((v) => (
            <li key={v.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><div className="font-medium">{v.brand} · {v.category} <span className="text-muted font-normal">v{v.version} · {v.gender.toLowerCase()} · {v.region}{v.product ? " · product-specific" : ""}</span></div>
                  {v.product && <div className="text-xs text-muted truncate max-w-md">{v.product}</div>}
                  <div className="text-xs text-muted truncate max-w-md">{v.sourceType.replaceAll("_", " ").toLowerCase()} · {v.extractionMethod ?? "n/a"} · {v.sourceUrl ?? "no URL"}</div>
                  {v.ambiguous.length > 0 && <div className="text-xs text-warn">Ambiguous measurements ({v.ambiguous.join(", ")}) are excluded from recommendations until resolved.</div>}</div>
                <DataBadge status={v.status} demo={v.isDemo} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button className="btn btn-ghost !h-8 !px-3" onClick={async () => { const r = await fetch(`/api/admin/size-charts/${v.id}/csv`); setCsv({ id: v.id, text: await r.text() }); }}>Preview CSV</button>
                {v.status !== "VERIFIED" && v.status !== "DEPRECATED" && <button className="btn btn-ghost !h-8 !px-3" disabled={busy === v.id} onClick={() => act(v.id, () => api(`/api/admin/size-charts/${v.id}`, { method: "PUT", json: { action: "APPROVE", note: "Compared with source" } }), "Approved and verified")}>{busy === v.id && <Loader2 size={14} className="animate-spin" />}Approve</button>}
                {v.ambiguous.length > 0 && v.status !== "DEPRECATED" && <button className="btn btn-ghost !h-8 !px-3" onClick={() => { const dim = v.ambiguous[0]; const kind = window.prompt(`Source says what for "${dim}"? Type BODY or GARMENT (applies to all ambiguous dimensions: ${v.ambiguous.join(", ")}). Only answer if the source states it.`); const t = kind?.trim().toUpperCase(); if (t !== "BODY" && t !== "GARMENT") return; const note = window.prompt("Where did you confirm this? (required)"); if (!note) return; act(v.id, () => api(`/api/admin/size-charts/${v.id}/edit`, { method: "POST", json: { resolveSemantics: Object.fromEntries(v.ambiguous.map((d) => [d, t === "BODY" ? "BODY_CIRCUMFERENCE" : "GARMENT_CIRCUMFERENCE"])), measurementType: t === "BODY" ? "BODY" : "GARMENT", note: `Resolved: ${note}` } }), "Saved as a new unverified version"); }}>Resolve ambiguity</button>}
                {v.status !== "DEPRECATED" && <button className="btn btn-quiet !h-8 !px-3" onClick={() => { const note = window.prompt("Why is this chart wrong? (saved to the audit log)"); if (note) act(v.id, () => api(`/api/admin/size-charts/${v.id}`, { method: "PUT", json: { action: "REJECT", note } }), "Rejected"); }}>Reject</button>}
                {v.status !== "DEPRECATED" && <button className="btn btn-quiet !h-8 !px-3" onClick={() => window.confirm("Deprecate? It stops being used for recommendations.") && act(v.id, () => api(`/api/admin/size-charts/${v.id}`, { method: "PUT", json: { action: "DEPRECATE" } }), "Deprecated")}>Deprecate</button>}
                <span className="text-xs text-muted self-center">{v.decisions} logged decision(s)</span>
              </div>
              {csv?.id === v.id && <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-paper p-3 text-xs">{csv.text}</pre>}
            </li>
          ))}
        </ul>
      )}

      {tab === "Research" && (
        <div className="mt-4 space-y-5">
          <form className="grid gap-3" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            const urls = String(f.get("urls")).split("\n").map((x) => x.trim()).filter(Boolean);
            const targets = urls.map((url) => ({ brand: f.get("brand"), category: f.get("category"), gender: f.get("gender"), region: String(f.get("region") || "GLOBAL").toUpperCase(), url, ...(f.get("marketplace") ? { marketplace: f.get("marketplace") } : {}), ...(f.get("productName") ? { productName: f.get("productName") } : {}) }));
            act("job", () => api("/api/admin/research", { method: "POST", json: { targets } }), "Research job finished");
          }}>
            <p className="text-sm text-muted">Only allow-listed sites can be fetched (brand sites and marketplaces). Pages are fetched politely, robots.txt is respected, blocks are never bypassed. Results are saved as <strong>unverified</strong>. Max 5 URLs per job.</p>
            <div className="grid sm:grid-cols-4 gap-3">
              <select name="brand" className="input" aria-label="Brand">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select>
              <select name="category" className="input" aria-label="Category">{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
              <select name="gender" className="input" aria-label="Gender"><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option><option value="UNISEX">Unisex</option></select>
              <input name="region" className="input" placeholder="Region (IN, GLOBAL…)" defaultValue="GLOBAL" aria-label="Region" />
              <select name="marketplace" className="input" aria-label="Marketplace"><option value="">Brand site (not a marketplace)</option>{marketplaces.map((m) => <option key={m.slug} value={m.slug}>{m.name} listing</option>)}</select>
              <input name="productName" className="input sm:col-span-3" placeholder="Product name (only for a single product listing)" aria-label="Product name" />
            </div>
            <textarea name="urls" required className="input !h-24 py-2.5 font-mono text-xs" placeholder="https://… (one per line)" aria-label="URLs" />
            <div><button className="btn btn-primary" disabled={busy === "job"}>{busy === "job" && <Loader2 size={16} className="animate-spin" />}Start research job</button></div>
          </form>
          <ul className="divide-y divide-line">
            {jobs.length === 0 && <li className="py-3 text-sm text-muted">No jobs yet.</li>}
            {jobs.map((j) => (
              <li key={j.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">Job {j.id.slice(-6)} · {j.state.toLowerCase()} <span className="text-muted font-normal">{new Date(j.createdAt).toLocaleString("en-IN")}</span></span>
                  {j.sources.some((s) => !["SUCCESS", "PARTIAL_SUCCESS", "NEEDS_HUMAN_VERIFICATION"].includes(s.status)) && <button className="btn btn-ghost !h-8 !px-3" disabled={busy === j.id} onClick={() => act(j.id, () => api(`/api/admin/research/${j.id}/retry`, { method: "POST" }), "Retry finished")}>Retry failed</button>}</div>
                <ul className="mt-1.5 space-y-1">{j.sources.map((s) => <li key={s.id} className="text-xs"><Pill t={s.status} /> <span className="text-muted break-all">{s.url}</span>{s.note && <div className="text-muted pl-1">{s.note}</div>}</li>)}</ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "Brands & products" && (
        <div className="mt-4 space-y-6">
          <ul className="divide-y divide-line">{brands.map((b) => (
            <li key={b.slug} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={b.active ? "" : "text-muted line-through"}>{b.name} <span className="text-muted text-xs">{b.region.toLowerCase()}</span></span>
              <span className="flex gap-1.5">
                <button className="btn btn-quiet !h-8 !px-3" onClick={() => { const name = window.prompt("New brand name", b.name); if (name && name !== b.name) act(b.slug, () => api(`/api/admin/brands/${b.slug}`, { method: "PATCH", json: { name } }), "Brand renamed"); }}>Edit</button>
                <button className="btn btn-ghost !h-8 !px-3" onClick={() => act(b.slug, () => api(`/api/admin/brands/${b.slug}`, { method: "PATCH", json: { active: !b.active } }), b.active ? "Deactivated" : "Activated")}>{b.active ? "Deactivate" : "Activate"}</button>
              </span>
            </li>))}</ul>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
            act("product", () => api("/api/admin/products", { method: "POST", json: { brandSlug: f.get("brand"), name: f.get("name"), categorySlug: f.get("category"), gender: f.get("gender"), fitCut: f.get("fitCut"), ...(f.get("marketplace") ? { marketplaceSlug: f.get("marketplace") } : {}), ...(f.get("url") ? { listingUrl: f.get("url") } : {}) } }).then(() => form.reset()), "Product saved"); }}>
            <h3 className="sm:col-span-3 font-semibold text-sm">Add a product (keeps its real brand; a marketplace is only where it is sold)</h3>
            <select name="brand" className="input" aria-label="Brand">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select>
            <input name="name" required className="input sm:col-span-2" placeholder="Product name" aria-label="Product name" />
            <select name="category" className="input" aria-label="Category">{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
            <select name="gender" className="input" aria-label="Gender"><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option><option value="UNISEX">Unisex</option></select>
            <select name="fitCut" className="input" aria-label="Garment cut">{["SLIM", "REGULAR", "RELAXED", "OVERSIZED"].map((x) => <option key={x}>{x}</option>)}</select>
            <select name="marketplace" className="input" aria-label="Marketplace"><option value="">Brand’s own site</option>{marketplaces.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select>
            <input name="url" type="url" className="input sm:col-span-2" placeholder="Product / listing URL" aria-label="Listing URL" />
            <div><button className="btn btn-ghost" disabled={busy === "product"}>Save product</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
