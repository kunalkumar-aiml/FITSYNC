"use client";
import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getCategoryConfig, recommend, type FitPreference, type SizeChart } from "@/lib/engine";

/**
 * Landing-page demonstration: one chest measurement, three sample size charts, three different labels.
 * The charts are invented for illustration (and say so on screen); the engine is the real one used in the app.
 */
const SAMPLES: { name: string; chart: SizeChart }[] = [
  { name: "Sample label A", chart: { measurementType: "GARMENT", status: "VERIFIED", rows: [{ label: "S", chest: 96 }, { label: "M", chest: 102 }, { label: "L", chest: 108 }, { label: "XL", chest: 114 }] } },
  { name: "Sample label B", chart: { measurementType: "GARMENT", status: "VERIFIED", rows: [{ label: "S", chest: 92 }, { label: "M", chest: 97 }, { label: "L", chest: 103 }, { label: "XL", chest: 109 }] } },
  { name: "Sample label C", chart: { measurementType: "GARMENT", status: "VERIFIED", rows: [{ label: "XS", chest: 98 }, { label: "S", chest: 104 }, { label: "M", chest: 110 }, { label: "L", chest: 116 }] } },
];
const FITS: { v: FitPreference; label: string }[] = [
  { v: "SLIM", label: "Slim" }, { v: "REGULAR", label: "Regular" }, { v: "RELAXED", label: "Relaxed" },
];
const cat = getCategoryConfig("tshirt")!;
const LO = 82, HI = 122;

export function FitDemo() {
  const id = useId();
  const [chest, setChest] = useState(94);
  const [fit, setFit] = useState<FitPreference>("REGULAR");
  const results = useMemo(() => SAMPLES.map((s) => recommend({ body: { chest }, chart: s.chart, category: cat, fitPreference: fit })), [chest, fit]);
  const band = cat.dimensions.chest!.ease[fit];
  const W = 760, padL = 120, padR = 70;
  const x = (cm: number) => padL + ((cm - LO) / (HI - LO)) * (W - padL - padR);
  const lane = (i: number) => 52 + i * 46;

  return (
    <div className="panel p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[16rem] flex-1 max-w-md">
          <label htmlFor={`${id}-chest`} className="label">Your chest measurement <span className="num font-semibold">{chest} cm</span> <span className="text-muted font-normal num">({(chest / 2.54).toFixed(1)} in)</span></label>
          <input id={`${id}-chest`} type="range" min={LO + 2} max={HI - 4} value={chest} onChange={(e) => setChest(+e.target.value)} className="w-full accent-[rgb(var(--primary))]" />
        </div>
        <div role="radiogroup" aria-label="How you like T-shirts to fit" className="seg">
          {FITS.map((f) => <button key={f.v} type="button" role="radio" aria-checked={fit === f.v} onClick={() => setFit(f.v)} className="seg-item">{f.label}</button>)}
        </div>
      </div>

      <div className="mt-6 -mx-5 px-5 sm:mx-0 sm:px-0 overflow-x-auto"><svg viewBox={`0 0 ${W} 200`} className="w-full min-w-[600px] h-auto" aria-hidden="true">
        <motion.rect initial={false} animate={{ x: x(chest + band.min), width: x(chest + band.max) - x(chest + band.min) }} transition={{ type: "spring", stiffness: 220, damping: 30 }}
          y={30} height={152} fill="rgb(var(--sage) / 0.28)" />
        {Array.from({ length: HI - LO + 1 }, (_, i) => LO + i).map((c) => (
          <g key={c}>
            <line x1={x(c)} x2={x(c)} y1={18} y2={c % 10 === 0 ? 30 : c % 5 === 0 ? 26 : 22} stroke="rgb(var(--muted))" strokeOpacity={c % 5 === 0 ? 0.9 : 0.4} />
            {c % 10 === 0 && <text x={x(c)} y={12} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{c}</text>}
          </g>
        ))}
        {SAMPLES.map((s, i) => {
          const r = results[i];
          const rec = r.status === "ok" ? r.recommendedSize : null;
          return (
            <g key={s.name}>
              <text x={0} y={lane(i) + 4} fontSize="12" fill="rgb(var(--muted))">{s.name}</text>
              <line x1={padL - 6} x2={W - padR + 6} y1={lane(i)} y2={lane(i)} stroke="rgb(var(--line))" />
              {s.chart.rows.map((row) => {
                const on = row.label === rec;
                return (
                  <g key={row.label}>
                    <rect x={x(row.chest!) - 15} y={lane(i) - 12} width={30} height={24} rx={2} fill={on ? "rgb(var(--ink))" : "rgb(var(--surface))"} stroke={on ? "rgb(var(--ink))" : "rgb(var(--line))"} />
                    <text x={x(row.chest!)} y={lane(i) + 4.5} textAnchor="middle" fontSize="12" fontWeight={on ? 650 : 450} fill={on ? "rgb(var(--paper))" : "rgb(var(--ink))"}>{row.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <motion.g initial={false} animate={{ x: x(chest) }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
          <line x1={0} x2={0} y1={20} y2={182} stroke="rgb(var(--accent))" strokeWidth="2" />
          <text x={0} y={196} textAnchor="middle" fontSize="11" fontWeight="600" fill="rgb(var(--accent-text))">you</text>
        </motion.g>
      </svg></div>

      <div className="mt-4 grid grid-cols-3 border-t border-line pt-5" aria-live="polite">
        {SAMPLES.map((s, i) => {
          const r = results[i];
          return (
            <div key={s.name} className="text-center">
              <p className="text-xs text-muted">{s.name}</p>
              <p className="mt-1 font-display text-d-md leading-none">{r.status === "ok" ? r.recommendedSize : "None"}</p>
              {r.status !== "ok" && <p className="mt-1 text-2xs text-muted">no size suits this fit</p>}
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-muted">Three invented charts, graded the way real brands differ. The shaded band is the garment chest that suits a {fit.toLowerCase()} fit for your measurement. Same engine as the app.</p>
    </div>
  );
}
