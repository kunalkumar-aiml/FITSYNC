"use client";
import { useMemo, useState } from "react";
import type { CoverageRow } from "@/lib/coverage";
import { Pill } from "./shared";

export function CoverageTable({ rows: all, categories }: { rows: CoverageRow[]; categories: { slug: string; name: string }[] }) {
  const [q, setQ] = useState(""); const [st, setSt] = useState(""); const [g, setG] = useState(""); const [c, setC] = useState("");
  const rows = useMemo(() => all.filter((r) => (!st || r.status === st) && (!g || r.gender === g) && (!c || r.category === c) &&
    (!q || `${r.brandName} ${r.product ?? ""} ${r.region}`.toLowerCase().includes(q.toLowerCase()))), [all, q, st, g, c]);
  const sel = "input !h-9 !text-sm !w-auto";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input className={`${sel} max-w-52`} placeholder="Search" aria-label="Search coverage" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={sel} aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{["Verified", "Unverified", "Missing", "Outdated", "Product-specific"].map((s) => <option key={s}>{s}</option>)}</select>
        <select className={sel} aria-label="Sizing" value={g} onChange={(e) => setG(e.target.value)}><option value="">Men and women</option><option value="MEN">Men</option><option value="WOMEN">Women</option></select>
        <select className={sel} aria-label="Category" value={c} onChange={(e) => setC(e.target.value)}><option value="">All categories</option>{categories.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select>
      </div>
      <p className="mt-2 text-xs text-muted">{rows.length} rows. Missing = no brand-level chart (shoppers see “Data unavailable”). Outdated = last update over a year ago.</p>
      <div className="mt-3 max-h-[32rem] overflow-auto border-t border-line">
        <table className="table-x">
          <thead className="sticky top-0 bg-paper"><tr><th>Brand</th><th>Category</th><th>Sizing</th><th>Region</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td className="font-medium">{r.brandName}{r.product && <span className="block font-normal text-xs text-muted max-w-56 truncate">{r.product}</span>}</td><td>{r.category}</td><td>{r.gender === "MEN" ? "Men" : "Women"}</td><td>{r.region}</td><td><Pill t={r.status} />{r.ambiguous && <span className="ml-1 text-xs text-warn">unclear meaning</span>}</td><td className="text-muted">{r.lastUpdated ?? "–"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
