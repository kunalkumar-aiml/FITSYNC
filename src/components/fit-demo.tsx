"use client";
import { useMemo, useState } from "react";
import { EaseRuler } from "./ease-ruler";
import { getCategoryConfig, recommend, type FitPreference, type SizeChart } from "@/lib/engine";

// Fictional demo numbers. Deliberately labelled as such on screen.
const DEMO_CHART: SizeChart = {
  measurementType: "GARMENT", status: "UNVERIFIED",
  rows: [
    { label: "S", chest: 96, shoulder: 42, waist: 94 }, { label: "M", chest: 102, shoulder: 44, waist: 100 },
    { label: "L", chest: 108, shoulder: 46, waist: 106 }, { label: "XL", chest: 114, shoulder: 48, waist: 112 },
  ],
};
const FITS: { v: FitPreference; label: string }[] = [
  { v: "SLIM", label: "Slim" }, { v: "REGULAR", label: "Regular" }, { v: "RELAXED", label: "Relaxed" }, { v: "OVERSIZED", label: "Oversized" },
];
const cat = getCategoryConfig("tshirt")!;

/** Runs the real recommendation engine in the browser against a demo chart. */
export function FitDemo() {
  const [chest, setChest] = useState(98);
  const [fit, setFit] = useState<FitPreference>("REGULAR");
  const res = useMemo(() => recommend({ body: { chest }, chart: DEMO_CHART, category: cat, fitPreference: fit }), [chest, fit]);
  const range = cat.dimensions.chest!.ease[fit];
  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="demo-chest" className="label">Your chest: <span className="tabular-nums">{chest} cm</span></label>
          <input id="demo-chest" type="range" min={80} max={125} value={chest} onChange={(e) => setChest(+e.target.value)}
            className="w-64 max-w-full accent-[rgb(var(--accent))]" />
        </div>
        <div role="radiogroup" aria-label="Fit preference" className="flex rounded-full border border-line p-1 bg-paper">
          {FITS.map((f) => (
            <button key={f.v} role="radio" aria-checked={fit === f.v} onClick={() => setFit(f.v)}
              className={`px-3 py-1.5 rounded-full text-sm transition ${fit === f.v ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <EaseRuler bodyCm={chest} dimensionLabel="Chest" band={{ min: chest + range.min, max: chest + range.max }}
          sizes={DEMO_CHART.rows.map((r) => ({ label: r.label, cm: r.chest! }))} recommended={res.status === "ok" ? res.recommendedSize : null} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm" aria-live="polite">
          {res.status === "ok" ? <>Best match: <strong className="text-lg">{res.recommendedSize}</strong> <span className="text-muted">· chest fit: {res.compatibility.chest}</span></>
            : res.status === "no_compatible_size" ? <>No size in this chart fits well.</> : <>Adjust your chest measurement.</>}
        </p>
        <p className="text-xs text-muted">Sample chart with made-up numbers. Same engine as the app.</p>
      </div>
    </div>
  );
}
