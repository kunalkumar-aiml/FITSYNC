"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "../toast";
import { useRouter } from "next/navigation";

type Props = { brands: { slug: string; name: string }[]; categories: { slug: string; name: string }[] };

/** CSV import. The server parses and validates; the unit, meaning and cut must be chosen explicitly (nothing defaults). */
export function ChartImport({ brands, categories }: Props) {
  const [preview, setPreview] = useState<{ rows: Record<string, number | string>[]; dimensions: string[] } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  return (
    <form className="grid gap-5" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const dry = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-dry") === "1";
      const payload = {
        brandSlug: f.get("brand"), categorySlug: f.get("category"), gender: f.get("gender"), region: String(f.get("region") || "").toUpperCase(),
        productLine: String(f.get("productLine") ?? ""), fitCut: f.get("fitCut") || undefined, measurementType: f.get("type") || undefined, originalUnit: f.get("unit") || undefined, sourceType: f.get("sourceType"),
        sourceUrl: String(f.get("url") ?? "") || undefined, sourceNote: String(f.get("note") ?? "") || undefined, csv: f.get("csv"), dryRun: dry,
      };
      setBusy(dry ? "preview" : "save"); setErrors([]);
      api<{ rows: Record<string, number | string>[]; dimensions: string[]; version?: { duplicate?: boolean; version: number } }>("/api/admin/size-charts/import", { method: "POST", json: payload })
        .then((r) => {
          if (dry) { setPreview(r); toast("success", `CSV is valid: ${r.rows.length} sizes. Nothing saved yet.`); }
          else { setPreview(null); toast("success", r.version?.duplicate ? `Identical to version ${r.version.version}; nothing new was saved.` : "Saved as a new unverified version"); router.refresh(); }
        })
        .catch((err) => { setPreview(null); if (err instanceof ClientError) { const d = err.details as Record<string, string[]> & { errors?: string[] }; setErrors(d?.errors ?? Object.entries(d ?? {}).map(([k, v]) => `${k}: ${v?.[0]}`).filter((x) => !x.endsWith("undefined")).concat(d ? [] : [err.message])); toast("error", err.message); } else toast("error", "Import failed."); })
        .finally(() => setBusy(null));
    }}>
      <div className="grid sm:grid-cols-3 gap-4">
        <div><label className="label" htmlFor="ab">Brand</label><select id="ab" name="brand" className="input">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
        <div><label className="label" htmlFor="ac">Category</label><select id="ac" name="category" className="input">{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="ag">Sizing</label><select id="ag" name="gender" className="input" defaultValue="MEN"><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option><option value="UNISEX">Unisex</option></select></div>
        <div><label className="label" htmlFor="ar">Size system / region</label><input id="ar" name="region" required className="input" placeholder="IN, GLOBAL, ASIA, EU…" /></div>
        <div><label className="label" htmlFor="ap">Product line <span className="text-muted font-normal">(optional)</span></label><input id="ap" name="productLine" className="input" placeholder="e.g. Oversized tees" /></div>
        <div><label className="label" htmlFor="af">Cut stated by the source</label><select id="af" name="fitCut" className="input" required defaultValue=""><option value="" disabled>Choose…</option><option value="UNKNOWN">Not stated</option>{["SLIM", "REGULAR", "RELAXED", "OVERSIZED"].map((x) => <option key={x} value={x}>{x.charAt(0) + x.slice(1).toLowerCase()}</option>)}</select></div>
        <div><label className="label" htmlFor="at">The numbers describe</label><select id="at" name="type" className="input" required defaultValue=""><option value="" disabled>Choose…</option><option value="BODY">The body</option><option value="GARMENT">The garment</option><option value="UNKNOWN">Source doesn’t say</option></select></div>
        <div><label className="label" htmlFor="au2">Unit used by the source</label><select id="au2" name="unit" className="input" required defaultValue=""><option value="" disabled>Choose…</option><option value="CM">Centimetres</option><option value="IN">Inches</option></select></div>
        <div><label className="label" htmlFor="as">Source type</label><select id="as" name="sourceType" className="input"><option value="OFFICIAL_SITE">Brand size guide</option><option value="OFFICIAL_PRODUCT_PAGE">Brand product page</option><option value="MARKETPLACE_LISTING">Marketplace listing</option><option value="OFFICIAL_PDF">Brand PDF</option><option value="STORE_MEASURED">Measured in store</option><option value="MANUAL_ENTRY">Manual entry</option></select></div>
      </div>
      <div>
        <div className="flex items-center justify-between"><label className="label !mb-0" htmlFor="csv">CSV</label>
          <input type="file" accept=".csv,text/csv,text/plain" aria-label="Upload CSV file" className="text-xs" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 50_000) { toast("error", "CSV files must be under 50 KB."); return; } (document.getElementById("csv") as HTMLTextAreaElement).value = await file.text(); }} /></div>
        <textarea id="csv" name="csv" required maxLength={50_000} className="input !h-40 py-2.5 mt-1.5 font-mono text-[13px]" placeholder={"label,chest,waist,hips\nS,35-37.5,29-32,35-37.5\nM,37.5-41,32-35,37.5-41"} />
        <p className="hint">Columns: label, then chest, waist, hips, shoulder, armLength, inseam, neck, thigh (or chest_min / chest_max). Ranges like 35-37.5 are fine; open-ended values like &lt;31 are rejected.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label" htmlFor="au">Source URL</label><input id="au" name="url" type="url" className="input" placeholder="https://" /></div>
        <div><label className="label" htmlFor="an">Source note</label><input id="an" name="note" className="input" maxLength={500} placeholder="Where exactly, and when you checked" /></div>
      </div>
      {errors.length > 0 && <ul role="alert" className="rounded-md border border-bad/40 bg-bad/5 px-4 py-3 text-sm list-disc pl-8">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
      {preview && <div className="overflow-x-auto panel"><table className="table-x"><thead><tr><th>Size</th>{preview.dimensions.map((d) => <th key={d}>{d} (cm)</th>)}</tr></thead>
        <tbody>{preview.rows.map((r) => <tr key={String(r.label)}><td className="font-semibold">{r.label}</td>{preview.dimensions.map((d) => <td key={d}>{r[d] ?? "–"}{r[d + "Max"] !== undefined ? `–${r[d + "Max"]}` : ""}</td>)}</tr>)}</tbody></table></div>}
      <div className="flex flex-wrap gap-2">
        <button data-dry="1" className="btn btn-ghost" disabled={busy !== null}>{busy === "preview" && <Loader2 size={16} className="animate-spin" />}Check and preview</button>
        <button className="btn btn-primary" disabled={busy !== null}>{busy === "save" && <Loader2 size={16} className="animate-spin" />}Save as unverified</button>
      </div>
    </form>
  );
}
