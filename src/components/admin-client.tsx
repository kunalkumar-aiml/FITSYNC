"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge } from "./badges";

type Version = { id: string; brand: string; category: string; fitCut: string; gender: string; region: string; productLine: string; sourceType: string; version: number; status: string; sourceUrl: string | null; sourceNote: string | null; isDemo: boolean };
type Coverage = { slug: string; name: string; note: string | null; cells: Record<string, { status: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE"; charts: number }> };
type Props = { brands: { slug: string; name: string }[]; categories: { slug: string; name: string }[]; versions: Version[]; coverage: Coverage[] };

export function AdminClient({ brands, categories, versions, coverage }: Props) {
  const [preview, setPreview] = useState<{ rows: Record<string, number | string>[]; dimensions: string[] } | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
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
        <h2 className="font-semibold">Import a size chart (CSV)</h2>
        <p className="text-sm text-muted mt-1">Paste or upload a CSV copied from the brand’s official size guide. Saved as a new <strong>unverified</strong> version, with the source recorded. Ranges like <code>35-37.5</code> are fine; open-ended values like <code>&lt;31</code> are rejected.</p>
        <form className="mt-4 grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const dry = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-dry") === "1";
          const payload = {
            brandSlug: f.get("brand"), categorySlug: f.get("category"), gender: f.get("gender"), region: String(f.get("region") || "GLOBAL").toUpperCase(),
            productLine: String(f.get("productLine") ?? ""), fitCut: f.get("fitCut"), measurementType: f.get("type"), originalUnit: f.get("unit"), sourceType: f.get("sourceType"),
            sourceUrl: String(f.get("url") ?? "") || undefined, sourceNote: String(f.get("note") ?? "") || undefined, csv: f.get("csv"), dryRun: dry,
          };
          setBusy(dry ? "preview" : "chart"); setCsvErrors([]);
          api<{ rows: Record<string, number | string>[]; dimensions: string[] }>("/api/admin/size-charts/import", { method: "POST", json: payload })
            .then((r) => { if (dry) { setPreview(r); toast("success", `CSV is valid: ${r.rows.length} sizes. Nothing saved yet.`); } else { setPreview(null); toast("success", "Saved as an unverified version"); router.refresh(); } })
            .catch((err) => { setPreview(null); if (err instanceof ClientError) { setCsvErrors((err.details as { errors?: string[] } | undefined)?.errors ?? [err.message]); toast("error", err.message); } else toast("error", "Import failed."); })
            .finally(() => setBusy(null));
        }}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label" htmlFor="ab">Brand</label><select id="ab" name="brand" className="input">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
            <div><label className="label" htmlFor="ac">Category</label><select id="ac" name="category" className="input">{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            <div><label className="label" htmlFor="ag">Men’s / Women’s</label><select id="ag" name="gender" className="input" defaultValue="MEN"><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option><option value="UNISEX">Unisex</option></select></div>
            <div><label className="label" htmlFor="ar">Region / sizing system</label><input id="ar" name="region" className="input" defaultValue="IN" placeholder="IN, GLOBAL, ASIA, US, EU" /></div>
            <div><label className="label" htmlFor="ap">Product line <span className="text-muted font-normal">(optional)</span></label><input id="ap" name="productLine" className="input" placeholder="e.g. Oversized tees" /></div>
            <div><label className="label" htmlFor="af">Garment cut</label><select id="af" name="fitCut" className="input" defaultValue="REGULAR">{["SLIM", "REGULAR", "RELAXED", "OVERSIZED"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="label" htmlFor="at">Numbers describe</label><select id="at" name="type" className="input"><option value="BODY">The body</option><option value="GARMENT">The garment</option></select></div>
            <div><label className="label" htmlFor="au2">Unit in the source</label><select id="au2" name="unit" className="input"><option value="CM">Centimetres</option><option value="IN">Inches</option></select></div>
            <div><label className="label" htmlFor="as">Source type</label><select id="as" name="sourceType" className="input"><option value="OFFICIAL_SITE">Official site</option><option value="OFFICIAL_PRODUCT_PAGE">Official product page</option><option value="MARKETPLACE_LISTING">Marketplace listing</option><option value="OFFICIAL_PDF">Official PDF</option><option value="STORE_MEASURED">Measured in store</option><option value="MANUAL_ENTRY">Manual entry</option></select></div>
          </div>
          <div>
            <div className="flex items-center justify-between"><label className="label !mb-0" htmlFor="csv">CSV</label>
              <input type="file" accept=".csv,text/csv,text/plain" aria-label="Upload CSV file" className="text-xs" onChange={async (e) => { const t = await e.target.files?.[0]?.text(); if (t !== undefined) (document.getElementById("csv") as HTMLTextAreaElement).value = t; }} /></div>
            <textarea id="csv" name="csv" required className="input !h-40 py-2.5 mt-1.5 font-mono text-[13px]" placeholder={"label,chest,waist,hips\nS,35-37.5,29-32,35-37.5\nM,37.5-41,32-35,37.5-41"} />
            <p className="mt-1 text-xs text-muted">Columns: label, then any of chest, waist, hips, shoulder, armLength, inseam, neck, thigh (or <code>chest_min</code>, <code>chest_max</code>).</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label" htmlFor="au">Source URL</label><input id="au" name="url" type="url" className="input" placeholder="https://" /></div>
            <div><label className="label" htmlFor="an">Source note</label><input id="an" name="note" className="input" placeholder="e.g. Men’s tops, retrieved 9 Nov 2026" /></div>
          </div>
          {csvErrors.length > 0 && <ul role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm list-disc pl-8">{csvErrors.map((x) => <li key={x}>{x}</li>)}</ul>}
          {preview && <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-xs tabular-nums"><thead><tr className="text-left text-muted border-b border-line"><th className="p-2">Size</th>{preview.dimensions.map((d) => <th key={d} className="p-2">{d} (cm)</th>)}</tr></thead>
            <tbody>{preview.rows.map((r) => <tr key={String(r.label)} className="border-b border-line/60"><td className="p-2 font-semibold">{r.label}</td>{preview.dimensions.map((d) => <td key={d} className="p-2">{r[d] ?? "–"}{r[d + "Max"] !== undefined ? `–${r[d + "Max"]}` : ""}</td>)}</tr>)}</tbody></table></div>}
          <div className="flex flex-wrap gap-2">
            <button data-dry="1" className="btn btn-ghost" disabled={busy !== null}>{busy === "preview" && <Loader2 size={16} className="animate-spin" />}Validate &amp; preview</button>
            <button className="btn btn-primary" disabled={busy !== null}>{busy === "chart" && <Loader2 size={16} className="animate-spin" />}Save as unverified</button>
          </div>
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
