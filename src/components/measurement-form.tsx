"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { MeasureGuide, type GuideKey } from "./measure-guide";
import { Notice } from "./ui";
import { LIMITS, fromCm, round1, toCm, type FitPreference, type Unit } from "@/lib/engine";

type Key = GuideKey;
type Field = { key: Key; label: string; limit?: [number, number]; how: string; needed?: string };

const STEPS: { title: string; blurb: string; fields: Field[] }[] = [
  { title: "Set up", blurb: "Choose your unit, which size charts to use, and how you like clothes to fit. You can change these later.", fields: [] },
  { title: "Upper body", blurb: "Chest matters most for tops. The others sharpen the result. Measure over light clothing or none, tape level and snug but not tight.", fields: [
    { key: "chestCm", label: "Chest", limit: LIMITS.chest, needed: "Needed for tops", how: "Under your arms, around the fullest part of your chest. Keep the tape level and breathe normally." },
    { key: "shoulderCm", label: "Shoulder width", limit: LIMITS.shoulder, how: "Straight across your back, from the outer edge of one shoulder bone to the other. Easier with a friend." },
    { key: "waistCm", label: "Waist", limit: LIMITS.waist, needed: "Needed for trousers", how: "Around your natural waist, the narrowest part of your torso, usually just above the belly button." },
    { key: "neckCm", label: "Neck", limit: LIMITS.neck, how: "Around the base of your neck where a shirt collar sits, with one finger of slack." },
    { key: "armLengthCm", label: "Arm length", limit: LIMITS.armLength, how: "Arm relaxed and slightly bent: from the shoulder bone down to the wrist bone." },
  ] },
  { title: "Lower body", blurb: "Add these for jeans, trousers, skirts and dresses. Skip anything you can’t measure.", fields: [
    { key: "hipsCm", label: "Hips", limit: LIMITS.hips, how: "Feet together, around the fullest part of your hips and seat." },
    { key: "thighCm", label: "Thigh", limit: LIMITS.thigh, how: "Around the fullest part of one thigh, just below the crotch." },
    { key: "inseamCm", label: "Inseam", limit: LIMITS.inseam, how: "From the crotch straight down the inside of the leg to the ankle bone. Measuring a pair of trousers that fit you well also works." },
  ] },
  { title: "Height and weight", blurb: "Context only. Neither decides your size on its own, and both are optional.", fields: [
    { key: "heightCm", label: "Height", limit: LIMITS.height, how: "Barefoot, back against a wall, from the floor to the top of your head." },
    { key: "weightKg", label: "Weight", how: "Optional, always in kilograms. Never used to pick a size by itself." },
  ] },
];

const FITS: { v: FitPreference; label: string; hint: string }[] = [
  { v: "SLIM", label: "Slim", hint: "Close to the body" },
  { v: "REGULAR", label: "Regular", hint: "Easy, everyday room" },
  { v: "RELAXED", label: "Relaxed", hint: "Roomier all round" },
  { v: "OVERSIZED", label: "Oversized", hint: "Deliberately big" },
];

export type Gender = "MEN" | "WOMEN" | "UNISEX";
export type FormInitial = Partial<Record<Key, number | null>> & { unit: Unit; fitPreference: FitPreference; gender?: Gender | null };
const ALL = STEPS.flatMap((s) => s.fields);

export function MeasurementForm({ initial, welcome }: { initial: FormInitial; welcome?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [fit, setFit] = useState<FitPreference>(initial.fitPreference);
  const [gender, setGender] = useState<Gender | null>(initial.gender ?? null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<Key | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<Key, string>>(() => {
    const o = {} as Record<Key, string>;
    for (const f of ALL) {
      const v = initial[f.key];
      o[f.key] = v == null ? "" : String(f.key === "weightKg" ? v : round1(fromCm(v, initial.unit)));
    }
    return o;
  });

  const filled = useMemo(() => Object.values(vals).filter((v) => v !== "").length, [vals]);
  const s = STEPS[step];
  const shown = focus && s.fields.some((f) => f.key === focus) ? focus : s.fields[0]?.key ?? null;

  function switchUnit(next: Unit) {
    if (next === unit) return;
    setVals((cur) => {
      const o = { ...cur };
      for (const k of Object.keys(o) as Key[]) {
        if (k === "weightKg" || o[k] === "") continue;
        const n = parseFloat(o[k]);
        if (!Number.isNaN(n)) o[k] = String(round1(fromCm(toCm(n, unit), next)));
      }
      return o;
    });
    setUnit(next);
  }

  function validateStep(i: number) {
    const errs: Partial<Record<Key, string>> = {};
    for (const f of STEPS[i].fields) {
      const raw = vals[f.key];
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) { errs[f.key] = "Enter a number, for example 96 or 96.5."; continue; }
      if (f.key === "weightKg") { if (n < 30 || n > 250) errs[f.key] = "Enter a weight between 30 and 250 kg."; continue; }
      const [lo, hi] = f.limit!;
      const cm = toCm(n, unit);
      if (cm < lo || cm > hi) errs[f.key] = `That looks off for ${f.label.toLowerCase()}: expected ${round1(fromCm(lo, unit))} to ${round1(fromCm(hi, unit))} ${unit === "CM" ? "cm" : "in"}. Check the unit.`;
    }
    setErrors((e) => ({ ...e, ...Object.fromEntries(STEPS[i].fields.map((f) => [f.key, undefined])), ...errs }));
    return Object.keys(errs).length === 0;
  }

  async function save() {
    for (let i = 0; i < STEPS.length; i++) if (!validateStep(i)) { setStep(i); return; }
    if (!gender) { setStep(0); setFormError("Choose which size charts to use: men’s, women’s or unisex."); return; }
    setBusy(true); setFormError(null);
    try {
      const json: Record<string, unknown> = { unit, fitPreference: fit, fitCategory: gender };
      for (const k of Object.keys(vals) as Key[]) json[k] = vals[k] === "" ? null : Number(vals[k]);
      await api("/api/measurements", { method: "PUT", json });
      toast("success", "Fit profile saved");
      router.push(welcome ? "/recommend" : "/dashboard");
      router.refresh();
    } catch (e) {
      setFormError(e instanceof ClientError ? e.message : "We couldn’t save. Check your connection and try again.");
      setBusy(false);
    }
  }

  const next = () => {
    if (step === 0 && !gender) { setFormError("Choose which size charts to use: men’s, women’s or unisex."); return; }
    setFormError(null);
    if (validateStep(step)) setStep(step + 1);
  };

  return (
    <div className="container-x pb-16">
      <header className="pt-10 sm:pt-14 pb-6">
        <h1 className="display-lg">{welcome ? "Build your fit profile" : "Fit profile"}</h1>
        <p className="mt-3 lede">A soft tape measure and five minutes. Every measurement is optional, and only you can see them.</p>
      </header>

      <ol className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-3 text-sm" aria-label="Steps">
        {STEPS.map((x, i) => (
          <li key={x.title}>
            <button type="button" onClick={() => (i < step || validateStep(step)) && (i === 0 || gender) && setStep(i)} aria-current={i === step ? "step" : undefined}
              className={`${i === step ? "text-ink font-medium" : "text-muted hover:text-ink"}`}><span className="num">{i + 1}</span>. {x.title}</button>
          </li>
        ))}
        <li className="ml-auto text-muted num">{filled} of {ALL.length} added</li>
      </ol>

      <div className="mt-8 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <h2 className="display-sm">{s.title}</h2>
              <p className="mt-2 text-muted max-w-prose">{s.blurb}</p>
              {formError && <div className="mt-5"><Notice tone="error" role="alert">{formError}</Notice></div>}

              {step === 0 && (
                <div className="mt-8 space-y-8">
                  <fieldset>
                    <legend className="label">Measure in</legend>
                    <div role="radiogroup" aria-label="Unit" className="seg">
                      {(["CM", "IN"] as Unit[]).map((u) => <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => switchUnit(u)} className="seg-item">{u === "CM" ? "Centimetres" : "Inches"}</button>)}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="label">Which size charts should we use?</legend>
                    <div role="radiogroup" aria-label="Sizing type" className="seg">
                      {([["MEN", "Men’s"], ["WOMEN", "Women’s"], ["UNISEX", "Unisex only"]] as [Gender, string][]).map(([g, l]) => <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => { setGender(g); setFormError(null); }} className="seg-item">{l}</button>)}
                    </div>
                    <p className="hint">Brands grade men’s and women’s clothing differently, so FITSYNC never mixes them. Unisex charts are used with either.</p>
                  </fieldset>
                  <fieldset>
                    <legend className="label">How do you like clothes to fit?</legend>
                    <div role="radiogroup" aria-label="Fit preference" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FITS.map((f) => (
                        <button key={f.v} type="button" role="radio" aria-checked={fit === f.v} onClick={() => setFit(f.v)}
                          className={`rounded-sm border p-3 text-left transition-colors ${fit === f.v ? "border-ink bg-surface" : "border-line hover:border-ink/40"}`}>
                          <span className="block font-medium text-sm">{f.label}</span><span className="block text-xs text-muted">{f.hint}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              <div className="mt-8 space-y-6">
                {s.fields.map((f) => (
                  <div key={f.key} className="grid sm:grid-cols-[11rem_1fr] gap-x-6 gap-y-2 border-t border-line pt-5">
                    <div>
                      <label htmlFor={f.key} className="label !mb-0">{f.label}</label>
                      {f.needed && <span className="mt-1 block text-xs text-accent-text">{f.needed}</span>}
                    </div>
                    <div>
                      <div className="relative max-w-[12rem]">
                        <input id={f.key} inputMode="decimal" className="input pr-12 num" value={vals[f.key]} aria-invalid={!!errors[f.key] || undefined}
                          aria-describedby={`${f.key}-how${errors[f.key] ? ` ${f.key}-err` : ""}`} placeholder="Optional" autoComplete="off"
                          onFocus={() => setFocus(f.key)} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") }))} />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{f.key === "weightKg" ? "kg" : unit === "CM" ? "cm" : "in"}</span>
                      </div>
                      {errors[f.key] && <p id={`${f.key}-err`} role="alert" className="field-error">{errors[f.key]}</p>}
                      <p id={`${f.key}-how`} className="hint max-w-prose">{f.how}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
            <button type="button" className="btn btn-quiet" onClick={() => setStep((x) => x - 1)} disabled={step === 0}><ArrowLeft size={16} />Back</button>
            <div className="flex gap-2">
              {step > 0 && step < STEPS.length - 1 && <button type="button" className="btn btn-ghost" onClick={save} disabled={busy}>Save now</button>}
              {step < STEPS.length - 1
                ? <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
                : <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Save fit profile</button>}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 lg:col-start-9 hidden md:block" aria-label="Where to measure">
          <div className="lg:sticky lg:top-24 panel p-6">
            {shown ? (
              <>
                <p className="text-sm font-medium">{ALL.find((f) => f.key === shown)?.label}</p>
                <div className="mt-4 mx-auto max-w-[14rem]"><MeasureGuide active={shown} /></div>
                <p className="mt-4 text-sm text-muted">{ALL.find((f) => f.key === shown)?.how}</p>
              </>
            ) : (
              <>
                <div className="mx-auto max-w-[14rem]"><MeasureGuide active={null} /></div>
                <p className="mt-4 text-sm text-muted">Use a soft tape measure. Measure your body, not your clothes, unless a step says otherwise.</p>
              </>
            )}
          </div>
        </aside>
      </div>
      <p className="mt-10 text-xs text-muted">Your measurements are private. Only you can see them, and you can delete them any time in Settings.</p>
    </div>
  );
}
