"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useAdminAction, Pill } from "./shared";
import { Notice } from "../ui";

type Job = { id: string; state: string; createdAt: string; createdBy: string | null; summary: { counts?: Record<string, number> } | null; sources: { id: string; url: string; status: string; note: string | null; httpStatus: number | null; chartVersionId: string | null }[] };
type Candidate = { url: string; title: string; host: string; kind: string; query: string };
type Discovery = { configured: boolean; provider: string | null; queries: string[]; candidates: Candidate[]; errors: string[] };
type Props = { jobs: Job[]; brands: { slug: string; name: string }[]; categories: { slug: string; name: string }[]; marketplaces: { slug: string; name: string }[]; discoveryConfigured: boolean };
const KIND: Record<string, string> = { OFFICIAL_SIZE_GUIDE: "Brand size guide", OFFICIAL_PRODUCT_PAGE: "Brand product page", MARKETPLACE_LISTING: "Marketplace listing", OTHER: "Other" };

export function ResearchPanel({ jobs, brands, categories, marketplaces, discoveryConfigured }: Props) {
  const { busy, act } = useAdminAction();
  const [target, setTarget] = useState({ brand: brands[0]?.slug ?? "", category: categories[0]?.slug ?? "", gender: "MEN" });
  const [disc, setDisc] = useState<Discovery | null>(null);
  const [discBusy, setDiscBusy] = useState(false);
  const [discErr, setDiscErr] = useState<string | null>(null);
  const [urls, setUrls] = useState("");

  async function discover(productQuery: string) {
    setDiscBusy(true); setDiscErr(null);
    try { setDisc(await api<Discovery>("/api/admin/research/discover", { method: "POST", json: { ...target, ...(productQuery ? { productQuery } : {}) } })); }
    catch (e) { setDiscErr(e instanceof ClientError ? e.message : "Discovery failed."); }
    setDiscBusy(false);
  }
  const addUrl = (u: string) => setUrls((cur) => (cur.split("\n").map((x) => x.trim()).includes(u) ? cur : [cur.trim(), u].filter(Boolean).join("\n")));

  return (
    <div className="space-y-14">
      <section>
        <h2 className="display-sm">1. Choose what to research</h2>
        <div className="mt-4 grid sm:grid-cols-3 gap-4 max-w-3xl">
          <div><label className="label" htmlFor="rb">Brand</label><select id="rb" className="input" value={target.brand} onChange={(e) => setTarget({ ...target, brand: e.target.value })}>{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
          <div><label className="label" htmlFor="rc">Category</label><select id="rc" className="input" value={target.category} onChange={(e) => setTarget({ ...target, category: e.target.value })}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="rg">Sizing</label><select id="rg" className="input" value={target.gender} onChange={(e) => setTarget({ ...target, gender: e.target.value })}><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option><option value="UNISEX">Unisex</option></select></div>
        </div>
      </section>

      <section>
        <h2 className="display-sm">2. Find sources</h2>
        <p className="mt-2 text-sm text-muted max-w-prose">Discovery asks a permitted search API for candidate pages and keeps only allow-listed brand and marketplace domains. It proposes URLs; it does not fetch them.</p>
        {!discoveryConfigured && <div className="mt-4 max-w-2xl"><Notice tone="info" title="Search API not configured">Set SEARCH_PROVIDER and its API key (docs/RESEARCH.md) to enable discovery. You can still paste source URLs below.</Notice></div>}
        <form className="mt-4 flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); discover(String(new FormData(e.currentTarget).get("pq") ?? "")); }}>
          <div><label className="label" htmlFor="pq">Product words <span className="text-muted font-normal">(optional)</span></label><input id="pq" name="pq" className="input w-72" maxLength={120} placeholder="e.g. oversized graphic tee" /></div>
          <button className="btn btn-ghost" disabled={discBusy || !discoveryConfigured}>{discBusy && <Loader2 size={16} className="animate-spin" />}Discover sources</button>
        </form>
        {discErr && <div className="mt-3"><Notice tone="error">{discErr}</Notice></div>}
        {disc && (
          <div className="mt-5">
            {disc.errors.map((x) => <p key={x} className="text-sm text-warn">{x}</p>)}
            <p className="text-xs text-muted">Queries: {disc.queries.join(" | ")}</p>
            {disc.candidates.length === 0 ? <p className="mt-2 text-sm text-muted">No allow-listed results.</p> : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {disc.candidates.map((c) => (
                  <li key={c.url} className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm">
                    <div className="min-w-0 max-w-2xl"><p className="font-medium">{c.title}</p><p className="text-xs text-muted break-all">{c.url}</p><p className="text-2xs text-muted mt-0.5">{KIND[c.kind]}</p></div>
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => addUrl(c.url)}>Add to job</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="display-sm">3. Run a research job</h2>
        <p className="mt-2 text-sm text-muted max-w-prose">Allow-listed sites only. Pages are fetched politely, robots.txt is respected, CAPTCHAs and logins are never bypassed. Results are saved as unverified or awaiting review. At most 5 URLs per job.</p>
        <form className="mt-4 grid gap-4 max-w-3xl" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          const list = urls.split("\n").map((x) => x.trim()).filter(Boolean);
          const targets = list.map((url) => ({ ...target, region: String(f.get("region") || "GLOBAL").toUpperCase(), url, ...(f.get("marketplace") ? { marketplace: f.get("marketplace") } : {}), ...(f.get("productName") ? { productName: f.get("productName") } : {}) }));
          act("job", () => api("/api/admin/research", { method: "POST", json: { targets } }), "Research job finished").then((r) => r && setUrls(""));
        }}>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label" htmlFor="rr">Size system / region</label><input id="rr" name="region" className="input" defaultValue="GLOBAL" /></div>
            <div><label className="label" htmlFor="rm">Source is</label><select id="rm" name="marketplace" className="input"><option value="">The brand’s own site</option>{marketplaces.map((m) => <option key={m.slug} value={m.slug}>A {m.name} listing</option>)}</select></div>
            <div><label className="label" htmlFor="rp">Product name <span className="text-muted font-normal">(single product)</span></label><input id="rp" name="productName" className="input" maxLength={200} /></div>
          </div>
          <div><label className="label" htmlFor="ru">URLs, one per line</label><textarea id="ru" required value={urls} onChange={(e) => setUrls(e.target.value)} className="input !h-28 py-2.5 font-mono text-xs" placeholder="https://" /></div>
          <div><button className="btn btn-primary" disabled={busy === "job"}>{busy === "job" && <Loader2 size={16} className="animate-spin" />}Start research job</button></div>
        </form>
      </section>

      <section>
        <h2 className="display-sm">Research history</h2>
        {jobs.length === 0 ? <p className="mt-3 text-sm text-muted">No jobs yet.</p> : (
          <ul className="mt-4 border-t border-line">
            {jobs.map((j) => (
              <li key={j.id} className="border-b border-line py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="font-medium">Job {j.id.slice(-6)}</span> <Pill t={j.state} /> <span className="text-muted">{new Date(j.createdAt).toLocaleString("en-IN")}{j.createdBy ? `, by ${j.createdBy}` : ""}</span></span>
                  {j.sources.some((s) => !["SUCCESS", "PARTIAL_SUCCESS", "NEEDS_HUMAN_VERIFICATION"].includes(s.status)) && <button type="button" className="btn btn-ghost btn-sm" disabled={busy === j.id} onClick={() => act(j.id, () => api(`/api/admin/research/${j.id}/retry`, { method: "POST" }), "Retry finished")}>Retry failed sources</button>}
                </div>
                <ul className="mt-2 space-y-2">{j.sources.map((s) => <li key={s.id} className="text-xs"><Pill t={s.status} />{s.httpStatus ? <span className="text-muted"> HTTP {s.httpStatus}</span> : null} <span className="text-muted break-all">{s.url}</span>{s.note && <span className="block text-muted mt-0.5">{s.note}</span>}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
