"use client";
import { useState } from "react";
import { ConfirmDialog } from "../confirm-dialog";
import { FIT_NAMES, GENDER_NAMES } from "../badges";
import { useAdminAction } from "./shared";

type Cat = { slug: string; name: string };
type B = { slug: string; name: string; region: string; active: boolean; isDemo: boolean; products: number; charts: number; note: string | null };

export function BrandsPanel({ brands, categories }: { brands: B[]; categories: Cat[] }) {
  const { busy, act, api } = useAdminAction();
  const [edit, setEdit] = useState<B | null>(null);
  const [toggle, setToggle] = useState<B | null>(null);
  const [noteFor, setNoteFor] = useState<B | null>(null);
  return (
    <div className="space-y-12">
      <table className="table-x">
        <thead><tr><th>Brand</th><th>Region</th><th>Charts</th><th>Products</th><th>Missing-data note</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{brands.map((b) => (
          <tr key={b.slug} className={b.active ? "" : "text-muted"}>
            <td className="font-medium">{b.name}{b.isDemo && <span className="tag ml-2">Sample</span>}{!b.active && <span className="tag ml-2">Inactive</span>}</td>
            <td>{b.region === "INDIAN" ? "Indian" : "International"}</td><td>{b.charts}</td><td>{b.products}</td>
            <td className="text-xs text-muted max-w-xs">{b.note ?? "None"}</td>
            <td className="whitespace-nowrap"><span className="flex gap-1">
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEdit(b)}>Edit</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setNoteFor(b)}>Note missing data</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setToggle(b)}>{b.active ? "Deactivate" : "Activate"}</button>
            </span></td>
          </tr>))}</tbody>
      </table>

      <section>
        <h2 className="text-lg font-semibold">Add a brand</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); act("brand", () => api("/api/admin/brands", { method: "POST", json: { name: f.get("name"), region: f.get("region") } }), "Brand added").then((r) => r && form.reset()); }}>
          <div><label className="label" htmlFor="bn">Name</label><input id="bn" name="name" required minLength={2} maxLength={60} className="input" /></div>
          <div><label className="label" htmlFor="br">Region</label><select id="br" name="region" className="input"><option value="INDIAN">Indian</option><option value="INTERNATIONAL">International</option></select></div>
          <button className="btn btn-primary" disabled={busy === "brand"}>Add brand</button>
        </form>
      </section>

      <ConfirmDialog open={!!edit} title={`Edit ${edit?.name ?? ""}`} tone="primary" confirmLabel="Save changes" busy={busy === "edit"} onClose={() => setEdit(null)}
        onConfirm={() => { const f = new FormData(document.getElementById("brand-edit") as HTMLFormElement); edit && act("edit", () => api(`/api/admin/brands/${edit.slug}`, { method: "PATCH", json: { name: f.get("name"), region: f.get("region") } }), "Brand updated").then(() => setEdit(null)); }}>
        <div id="brand-edit-wrap"><form id="brand-edit" className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
          <div><label className="label !text-ink" htmlFor="en">Name</label><input id="en" name="name" defaultValue={edit?.name} className="input" key={edit?.slug} /></div>
          <div><label className="label !text-ink" htmlFor="er">Region</label><select id="er" name="region" defaultValue={edit?.region} key={`r${edit?.slug}`} className="input"><option value="INDIAN">Indian</option><option value="INTERNATIONAL">International</option></select></div>
        </form></div>
      </ConfirmDialog>
      <ConfirmDialog open={!!toggle} title={toggle?.active ? `Deactivate ${toggle?.name}?` : `Activate ${toggle?.name}?`} tone={toggle?.active ? "danger" : "primary"} confirmLabel={toggle?.active ? "Deactivate" : "Activate"} busy={busy === "toggle"} onClose={() => setToggle(null)}
        onConfirm={() => toggle && act("toggle", () => api(`/api/admin/brands/${toggle.slug}`, { method: "PATCH", json: { active: !toggle.active } }), toggle.active ? "Brand deactivated" : "Brand activated").then(() => setToggle(null))}>
        <p>{toggle?.active ? "The brand disappears from the explorer, recommendations and comparisons. Charts and history are kept." : "The brand becomes visible again."}</p>
      </ConfirmDialog>
      <CoverageNoteDialog brand={noteFor} categories={categories} onClose={() => setNoteFor(null)} />
    </div>
  );
}

function CoverageNoteDialog({ brand, categories, onClose, productId, productName }: { brand: { slug: string; name: string } | null; categories: Cat[]; onClose: () => void; productId?: string; productName?: string }) {
  const { busy, act, api } = useAdminAction();
  return (
    <ConfirmDialog open={!!brand} title={productName ? `Missing data: ${productName}` : `Missing data: ${brand?.name ?? ""}`} tone="primary" confirmLabel="Save note" busy={busy === "note"} onClose={onClose}
      onConfirm={() => { const f = new FormData(document.getElementById("cov-note") as HTMLFormElement); brand && act("note", () => api("/api/admin/coverage-notes", { method: "POST", json: { brandSlug: brand.slug, ...(productId ? { productId } : {}), ...(f.get("category") ? { categorySlug: f.get("category") } : {}), ...(f.get("gender") ? { gender: f.get("gender") } : {}), note: f.get("note"), ...(f.get("url") ? { sourceUrl: f.get("url") } : {}) } }), "Note saved").then((r) => r && onClose()); }}>
      <p>Shown to shoppers as “Data unavailable”. Say what you checked.</p>
      <form id="cov-note" className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
        {!productId && <div className="grid grid-cols-2 gap-3">
          <div><label className="label !text-ink" htmlFor="nc">Category</label><select id="nc" name="category" className="input"><option value="">All</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
          <div><label className="label !text-ink" htmlFor="ng">Sizing</label><select id="ng" name="gender" className="input"><option value="">All</option><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option></select></div>
        </div>}
        <div><label className="label !text-ink" htmlFor="nn">What was checked</label><textarea id="nn" name="note" className="input !h-24 py-2" maxLength={500} placeholder="e.g. Size guide is rendered by JavaScript per product; no brand-wide table published." /></div>
        <div><label className="label !text-ink" htmlFor="nu">Page checked (optional)</label><input id="nu" name="url" type="url" className="input" placeholder="https://" /></div>
      </form>
    </ConfirmDialog>
  );
}

type P = { id: string; name: string; brand: string; brandSlug: string; category: string; gender: string; fitCut: string; fitCutStated: boolean; charts: number; note: string | null; listings: { url: string; where: string }[] };
type M = { slug: string; name: string; domain: string; listings: number };

export function ProductsPanel({ products, brands, categories, marketplaces }: { products: P[]; brands: { slug: string; name: string }[]; categories: Cat[]; marketplaces: M[] }) {
  const { busy, act, api } = useAdminAction();
  const [noteFor, setNoteFor] = useState<P | null>(null);
  const [stated, setStated] = useState(false);
  return (
    <div className="space-y-12">
      <div className="overflow-x-auto">
        <table className="table-x min-w-[48rem]">
          <thead><tr><th>Product</th><th>Brand</th><th>Category</th><th>Cut</th><th>Sold on</th><th>Charts</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{products.map((p) => (
            <tr key={p.id}>
              <td className="font-medium max-w-xs">{p.name}{p.note && <span className="block text-xs text-muted font-normal">Missing data: {p.note}</span>}</td>
              <td>{p.brand}</td><td>{p.category}, {GENDER_NAMES[p.gender]?.toLowerCase()}</td>
              <td>{FIT_NAMES[p.fitCut] ?? p.fitCut}{!p.fitCutStated && p.fitCut !== "UNKNOWN" && <span className="block text-2xs text-warn">not stated on listing</span>}</td>
              <td className="text-xs">{p.listings.map((l) => <span key={l.url} className="block">{l.where}</span>)}</td>
              <td>{p.charts}</td>
              <td><button type="button" className="btn btn-quiet btn-sm" onClick={() => setNoteFor(p)}>Note missing data</button></td>
            </tr>))}</tbody>
        </table>
        {products.length === 0 && <p className="mt-3 text-sm text-muted">No products yet.</p>}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Add a product</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          act("product", () => api("/api/admin/products", { method: "POST", json: { brandSlug: f.get("brand"), name: f.get("name"), categorySlug: f.get("category"), gender: f.get("gender"), fitCut: stated ? f.get("fitCut") : "UNKNOWN", fitCutStated: stated, ...(f.get("marketplace") ? { marketplaceSlug: f.get("marketplace") } : {}), ...(f.get("url") ? { listingUrl: f.get("url") } : {}) } }), "Product saved").then((r) => { if (r) { form.reset(); setStated(false); } }); }}>
          <div><label className="label" htmlFor="pb">Brand</label><select id="pb" name="brand" className="input">{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pn">Product name, as listed</label><input id="pn" name="name" required minLength={3} maxLength={200} className="input" /></div>
          <div><label className="label" htmlFor="pc">Category</label><select id="pc" name="category" className="input">{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="pg">Sizing</label><select id="pg" name="gender" className="input"><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option><option value="UNISEX">Unisex</option></select></div>
          <div><label className="label" htmlFor="pf">Cut</label>
            <select id="pf" name="fitCut" className="input" disabled={!stated}>{["SLIM", "REGULAR", "RELAXED", "OVERSIZED"].map((x) => <option key={x} value={x}>{FIT_NAMES[x]}</option>)}</select>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={stated} onChange={(e) => setStated(e.target.checked)} />The listing states this cut</label></div>
          <div><label className="label" htmlFor="pm">Sold on</label><select id="pm" name="marketplace" className="input"><option value="">Brand’s own site</option>{marketplaces.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pu">Product or listing URL</label><input id="pu" name="url" type="url" className="input" placeholder="https://" /></div>
          <div className="sm:col-span-3"><button className="btn btn-primary" disabled={busy === "product"}>Save product</button></div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Marketplaces</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">{marketplaces.map((m) => <li key={m.slug} className="flex justify-between py-2.5"><span className="font-medium">{m.name}</span><span className="text-muted">{m.domain}, {m.listings} listing(s)</span></li>)}</ul>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); act("mk", () => api("/api/admin/marketplaces", { method: "POST", json: { name: f.get("name"), domain: f.get("domain") } }), "Marketplace added").then((r) => r && form.reset()); }}>
          <div><label className="label" htmlFor="mn">Name</label><input id="mn" name="name" required minLength={2} className="input" /></div>
          <div><label className="label" htmlFor="md">Domain</label><input id="md" name="domain" required className="input" placeholder="www.example.com" /></div>
          <button className="btn btn-ghost" disabled={busy === "mk"}>Add marketplace</button>
        </form>
        <p className="hint">New marketplaces can only be fetched by the research pipeline once their domain is added to the allow-list in code (src/lib/research/url-safety.ts).</p>
      </section>
      <CoverageNoteDialog brand={noteFor ? { slug: noteFor.brandSlug, name: noteFor.brand } : null} productId={noteFor?.id} productName={noteFor?.name} categories={categories} onClose={() => setNoteFor(null)} />
    </div>
  );
}
