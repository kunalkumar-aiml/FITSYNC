"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge } from "./badges";
import { DIMENSIONS } from "@/lib/engine";

type Version = { id: string; brand: string; category: string; fitCut: string; version: number; status: string; sourceUrl: string | null; sourceNote: string | null; isDemo: boolean };
type Props = { brands: { slug: string; name: string }[]; categories: { slug: string; name: string }[]; versions: Version[] };

// Parses "label,chest,shoulder,waist" CSV (first line is the header) into chart rows.
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Add a header line and at least two sizes.");
  const head = lines[0].split(",").map((h) => h.trim());
  if (head[0].toLowerCase() !== "label") throw new Error('The first column must be "label".');
  const bad = head.slice(1).filter((h) => !(DIMENSIONS as string[]).includes(h));
  if (bad.length) throw new Error(`Unknown column: ${bad.join(", ")}. Use: ${DIMENSIONS.join(", ")}.`);
  return lines.slice(1).map((l) => {
    const cells = l.split(",").map((c) => c.trim());
    const row: Record<string, string | number> = { label: cells[0] };
    head.slice(1).forEach((h, i) => { if (cells[i + 1]) { const n = parseFloat(cells[i + 1]); if (Number.isNaN(n)) throw new Error(`"${cells[i + 1]}" is not a number.`); row[h] = n; } });
    return row;
  });
}

export function AdminClient({ brands, categories, versions }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<void>, ok: string) {
    setBusy(key);
    try { await fn(); toast("success", ok); router.refresh(); }
    catch (e) { toast("error", e instanceof ClientError ? e.message : e instanceof Error ? e.message : "Failed."); }
    setBusy(null);
  }

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-semibold">Size chart versions</h2>
        <p className="text-sm text-muted mt-1">Mark a version Verified only after checking it against the brand’s own published chart. A source is required.</p>
        <ul className="mt-4 divide-y divide-line">
          {versions.length === 0 && <li className="py-3 text-sm text-muted">No charts yet. Add one below.</li>}
          {versions.map((v) => (
            <li key={v.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><div className="font-medium">{v.brand} · {v.category} <span className="text-muted font-normal">v{v.version} · {v.fitCut.toLowerCase()}</span></div>
                <div className="text-xs text-muted truncate max-w-md">{v.sourceUrl ?? v.sourceNote ?? "No source recorded"}</div></div>
              <div className="flex items-center gap-2"><DataBadge status={v.status} demo={v.isDemo} />
                {v.status !== "VERIFIED" && <button className="btn btn-ghost !h-8 !px-3" disabled={busy === v.id}
                  onClick={() => {
                    const hasSource = v.sourceUrl || (v.sourceNote && !v.isDemo);
                    const src = hasSource ? null : window.prompt("Source URL where this chart is published:");
                    if (!hasSource && !src) return;
                    act(v.id, () => api(`/api/admin/size-charts/${v.id}`, { method: "PUT", json: { status: "VERIFIED", ...(src ? { sourceUrl: src } : {}) } }).then(() => {}), "Marked verified");
                  }}>{busy === v.id && <Loader2 size={14} className="animate-spin" />}Verify</button>}
                {v.status !== "DEPRECATED" && <button className="btn btn-quiet !h-8 !px-3" disabled={busy === v.id}
                  onClick={() => window.confirm("Deprecate this version? It will stop being used for recommendations.") && act(v.id, () => api(`/api/admin/size-charts/${v.id}`, { method: "PUT", json: { status: "DEPRECATED" } }).then(() => {}), "Deprecated")}>Deprecate</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Add or update a size chart</h2>
        <p className="text-sm text-muted mt-1">Saved as a new unverified version. Values in cm.</p>
        <form className="mt-4 grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          let rows;
          try { rows = parseCsv(String(f.get("csv"))); } catch (err) { toast("error", (err as Error).message); return; }
          act("chart", () => api("/api/admin/size-charts", { method: "POST", json: {
            brandSlug: f.get("brand"), categorySlug: f.get("category"), fitCut: f.get("fitCut"), measurementType: f.get("type"), rows,
            sourceUrl: String(f.get("url") ?? "") || undefined, sourceNote: String(f.get("note") ?? "") || undefined,
          } }).then(() => {}), "Chart version saved as unverified");
        }}>
          <div className="grid sm:grid-cols-4 gap-3">
            <div><label className="label" htmlFor="ab">Brand</label><select id="ab" name="brand" className="input">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
            <div><label className="label" htmlFor="ac">Category</label><select id="ac" name="category" className="input">{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            <div><label className="label" htmlFor="af">Cut</label><select id="af" name="fitCut" className="input" defaultValue="REGULAR">{["SLIM", "REGULAR", "RELAXED", "OVERSIZED"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="label" htmlFor="at">Numbers describe</label><select id="at" name="type" className="input"><option value="GARMENT">The garment</option><option value="BODY">The body</option></select></div>
          </div>
          <div><label className="label" htmlFor="csv">Sizes (CSV)</label>
            <textarea id="csv" name="csv" required className="input !h-36 py-2.5 font-mono text-[13px]" placeholder={"label,chest,shoulder,waist\nS,96,42,94\nM,102,44,100"} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label" htmlFor="au">Source URL</label><input id="au" name="url" type="url" className="input" placeholder="https://" /></div>
            <div><label className="label" htmlFor="an">Source note</label><input id="an" name="note" className="input" placeholder="e.g. Brand website, men’s tops, checked 7 Nov 2026" /></div>
          </div>
          <div><button className="btn btn-primary" disabled={busy === "chart"}>{busy === "chart" && <Loader2 size={16} className="animate-spin" />}Save as unverified</button></div>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Add a brand</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          act("brand", () => api("/api/admin/brands", { method: "POST", json: { name: f.get("name"), region: f.get("region") } }).then(() => form.reset()), "Brand added");
        }}>
          <div><label className="label" htmlFor="bn">Name</label><input id="bn" name="name" required minLength={2} className="input" /></div>
          <div><label className="label" htmlFor="br">Region</label><select id="br" name="region" className="input"><option value="INDIAN">Indian</option><option value="INTERNATIONAL">International</option></select></div>
          <button className="btn btn-ghost" disabled={busy === "brand"}>Add brand</button>
        </form>
      </section>
    </div>
  );
}
