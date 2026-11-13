"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataBadge, GENDER_NAMES } from "./badges";
import { EmptyState } from "./ui";

export type ExplorerBrand = {
  slug: string; name: string; region: string; isDemo: boolean; note: string | null;
  charts: { category: string; categoryName: string; gender: string; region: string; product: boolean; verified: boolean }[];
};

const AVAIL = [["", "Any data"], ["brand", "Brand-level chart"], ["product", "Product charts"], ["none", "Data unavailable"]] as const;
const VERIF = [["", "Any status"], ["verified", "Verified"], ["unverified", "Unverified only"]] as const;

export function BrandExplorer({ brands, categories }: { brands: ExplorerBrand[]; categories: { slug: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [avail, setAvail] = useState("");
  const [verif, setVerif] = useState("");

  const rows = useMemo(() => brands.map((b) => {
    const charts = b.charts.filter((c) => (!gender || c.gender === gender || c.gender === "UNISEX") && (!category || c.category === category));
    return { ...b, matching: charts };
  }).filter((b) => {
    if (q && !b.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (region && b.region !== region) return false;
    const m = b.matching;
    if (avail === "brand" && !m.some((c) => !c.product)) return false;
    if (avail === "product" && !m.some((c) => c.product)) return false;
    if (avail === "none" && m.length) return false;
    if (verif === "verified" && !m.some((c) => c.verified)) return false;
    if (verif === "unverified" && (!m.length || m.some((c) => c.verified))) return false;
    return true;
  }), [brands, q, gender, category, region, avail, verif]);

  const sel = "input !h-10 !text-sm";
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(5,1fr)] border-y border-line py-4" role="search" aria-label="Filter brands">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className={`${sel} pl-9`} placeholder="Search brands" aria-label="Search brands" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={sel} aria-label="Sizing type" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Men’s and women’s</option><option value="MEN">Men’s</option><option value="WOMEN">Women’s</option></select>
        <select className={sel} aria-label="Clothing category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All clothing</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <select className={sel} aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)}><option value="">All regions</option><option value="INDIAN">Indian brands</option><option value="INTERNATIONAL">International</option></select>
        <select className={sel} aria-label="Data availability" value={avail} onChange={(e) => setAvail(e.target.value)}>{AVAIL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className={sel} aria-label="Verification status" value={verif} onChange={(e) => setVerif(e.target.value)}>{VERIF.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">{rows.length} {rows.length === 1 ? "brand" : "brands"}</p>

      {rows.length === 0 ? <div className="mt-6"><EmptyState title="No brands match">Clear a filter to see more brands.</EmptyState></div> : (
        <ul className="mt-6 grid md:grid-cols-2 gap-x-10">
          {rows.map((b) => {
            const m = b.matching;
            const sets = [...new Set(m.map((c) => `${c.categoryName} (${GENDER_NAMES[c.gender].toLowerCase()}${c.product ? ", product" : ""})`))];
            return (
              <li key={b.slug} className="border-t border-line">
                <Link href={`/brands/${b.slug}`} className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-5">
                  <span className="font-display text-d-sm group-hover:text-primary">{b.name}</span>
                  <span className="self-center">{m.length ? <DataBadge status={m.some((c) => c.verified) ? "VERIFIED" : "UNVERIFIED"} demo={b.isDemo} /> : <span className="tag">Data unavailable</span>}</span>
                  <span className="col-span-2 text-sm text-muted">
                    {b.region === "INDIAN" ? "Indian brand" : "International brand"}.{" "}
                    {sets.length ? sets.join(", ") : (gender || category) ? "No chart for this filter." : (b.note ?? "No usable official chart found yet.")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
