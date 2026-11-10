"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { LIMITS, fromCm, round1, toCm, type FitPreference, type Unit } from "@/lib/engine";

type Key = "heightCm" | "weightKg" | "chestCm" | "waistCm" | "hipsCm" | "shoulderCm" | "armLengthCm" | "inseamCm" | "neckCm" | "thighCm";
type Field = { key: Key; label: string; limit?: [number, number]; how: string; needed?: string };

const STEPS: { title: string; blurb: string; fields: Field[] }[] = [
  { title: "The basics", blurb: "Height and weight give context. They don’t decide your size on their own.", fields: [
    { key: "heightCm", label: "Height", limit: LIMITS.height, how: "Stand straight against a wall, barefoot, and measure floor to top of head." },
    { key: "weightKg", label: "Weight (kg)", how: "Optional. Used only as context, never to pick a size by itself." },
  ] },
  { title: "Upper body", blurb: "Chest matters most for tops. The others sharpen the result.", fields: [
    { key: "chestCm", label: "Chest", limit: LIMITS.chest, needed: "Needed for tops", how: "Wrap the tape under your arms and across the fullest part of your chest. Keep it level and snug, not tight. Breathe normally." },
    { key: "waistCm", label: "Waist", limit: LIMITS.waist, needed: "Needed for trousers", how: "Measure around your natural waist, the narrowest part of your torso, roughly above the belly button." },
    { key: "shoulderCm", label: "Shoulder width", limit: LIMITS.shoulder, how: "Measure straight across your back from the edge of one shoulder bone to the other. A friend helps." },
    { key: "neckCm", label: "Neck", limit: LIMITS.neck, how: "Wrap the tape around the base of your neck, where a collar sits, with one finger of slack." },
    { key: "armLengthCm", label: "Arm length", limit: LIMITS.armLength, how: "With your arm slightly bent, measure from the shoulder bone to the wrist bone." },
  ] },
  { title: "Lower body", blurb: "Add these for jeans and trousers. Skip anything you can’t measure.", fields: [
    { key: "hipsCm", label: "Hips", limit: LIMITS.hips, how: "Measure around the fullest part of your hips and seat, with feet together." },
    { key: "thighCm", label: "Thigh", limit: LIMITS.thigh, how: "Measure around the fullest part of one thigh, just below the hip crease." },
    { key: "inseamCm", label: "Inseam", limit: LIMITS.inseam, how: "Measure from the crotch down to the ankle bone along the inside of your leg." },
  ] },
];

const FITS: { v: FitPreference; label: string; hint: string }[] = [
  { v: "SLIM", label: "Slim", hint: "Close to the body" },
  { v: "REGULAR", label: "Regular", hint: "Easy, everyday fit" },
  { v: "RELAXED", label: "Relaxed", hint: "Roomier all round" },
  { v: "OVERSIZED", label: "Oversized", hint: "Deliberately big" },
];

export type Gender = "MEN" | "WOMEN" | "UNISEX";
export type FormInitial = Partial<Record<Key, number | null>> & { unit: Unit; fitPreference: FitPreference; gender?: Gender | null };

export function MeasurementForm({ initial, welcome }: { initial: FormInitial; welcome?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [fit, setFit] = useState<FitPreference>(initial.fitPreference);
  const [gender, setGender] = useState<Gender | null>(initial.gender ?? null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [vals, setVals] = useState<Record<Key, string>>(() => {
    const o = {} as Record<Key, string>;
    for (const f of STEPS.flatMap((s) => s.fields)) {
      const v = initial[f.key];
      o[f.key] = v == null ? "" : String(f.key === "weightKg" ? v : round1(fromCm(v, initial.unit)));
    }
    return o;
  });

  const filled = useMemo(() => Object.values(vals).filter((v) => v !== "").length, [vals]);
  const total = Object.keys(vals).length;

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
      const n = parseFloat(raw);
      if (Number.isNaN(n) || n <= 0) { errs[f.key] = "Enter a number."; continue; }
      if (f.key === "weightKg") { if (n < 30 || n > 250) errs[f.key] = "Enter a weight between 30 and 250 kg."; continue; }
      const [lo, hi] = f.limit!;
      const cm = toCm(n, unit);
      if (cm < lo || cm > hi) errs[f.key] = `That looks off. Expected ${round1(fromCm(lo, unit))}–${round1(fromCm(hi, unit))} ${unit.toLowerCase()}. Check the unit.`;
    }
    setErrors((e) => ({ ...e, ...Object.fromEntries(STEPS[i].fields.map((f) => [f.key, undefined])), ...errs }));
    return Object.keys(errs).length === 0;
  }

  async function save() {
    for (let i = 0; i < STEPS.length; i++) if (!validateStep(i)) { setStep(i); return; }
    setBusy(true);
    try {
      const json: Record<string, unknown> = { unit, fitPreference: fit, fitCategory: gender };
      for (const k of Object.keys(vals) as Key[]) json[k] = vals[k] === "" ? null : parseFloat(vals[k]);
      await api("/api/measurements", { method: "PUT", json });
      toast("success", "Fit profile saved");
      router.push(welcome ? "/recommend" : "/dashboard");
      router.refresh();
    } catch (e) {
      toast("error", e instanceof ClientError ? e.message : "Couldn’t save. Check your connection and try again.");
      setBusy(false);
    }
  }

  const s = STEPS[step];
  return (
    <div className="container-x py-8 sm:py-12 max-w-2xl">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Step {step + 1} of {STEPS.length}</span>
        <span>{filled} of {total} measurements added</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <h1 className="mt-8 text-3xl font-semibold">{welcome && step === 0 ? "Let’s build your fit profile" : s.title}</h1>
      <p className="mt-2 text-muted">{s.blurb}</p>

      {step === 0 && (
        <div className="mt-6 space-y-5">
          <div>
            <span className="label">Measure in</span>
            <div role="radiogroup" aria-label="Unit" className="inline-flex rounded-full border border-line p-1 bg-surface">
              {(["CM", "IN"] as Unit[]).map((u) => (
                <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => switchUnit(u)}
                  className={`px-4 py-1.5 rounded-full text-sm ${unit === u ? "bg-ink text-paper" : "text-muted"}`}>{u === "CM" ? "Centimetres" : "Inches"}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Which size charts should we use?</span>
            <div role="radiogroup" aria-label="Sizing type" className="inline-flex rounded-full border border-line p-1 bg-surface">
              {([["MEN", "Men’s"], ["WOMEN", "Women’s"], ["UNISEX", "Unisex"]] as [Gender, string][]).map(([g, l]) => (
                <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)}
                  className={`px-4 py-1.5 rounded-full text-sm ${gender === g ? "bg-ink text-paper" : "text-muted"}`}>{l}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">Brands size men’s and women’s clothing differently, so we never mix them.</p>
          </div>
          <div>
            <span className="label">How do you like your clothes to fit?</span>
            <div role="radiogroup" aria-label="Fit preference" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FITS.map((f) => (
                <button key={f.v} type="button" role="radio" aria-checked={fit === f.v} onClick={() => setFit(f.v)}
                  className={`rounded-xl border p-3 text-left transition ${fit === f.v ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-ink/40"}`}>
                  <div className="font-medium text-sm">{f.label}</div>
                  <div className="text-xs text-muted">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {s.fields.map((f) => (
          <div key={f.key} className="card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={f.key} className="label !mb-0">{f.label}{f.key !== "weightKg" && <span className="text-muted font-normal"> ({unit.toLowerCase()})</span>}</label>
              {f.needed && <span className="chip">{f.needed}</span>}
            </div>
            <input id={f.key} inputMode="decimal" className="input mt-2" value={vals[f.key]} aria-invalid={!!errors[f.key]} aria-describedby={`${f.key}-how`}
              placeholder="Optional" onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(",", ".") }))} />
            {errors[f.key] && <p role="alert" className="mt-1.5 text-sm text-bad">{errors[f.key]}</p>}
            <p id={`${f.key}-how`} className="mt-2 text-xs text-muted">{f.how}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button type="button" className="btn btn-ghost" onClick={() => setStep((x) => x - 1)} disabled={step === 0}><ArrowLeft size={16} />Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => validateStep(step) && setStep(step + 1)}>Next <ArrowRight size={16} /></button>
        ) : (
          <button type="button" className="btn btn-accent" onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Save fit profile</button>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">Your measurements are private. Only you can see them, and you can delete them any time in Settings.</p>
    </div>
  );
}
