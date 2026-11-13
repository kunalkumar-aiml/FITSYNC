"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge, FIT_NAMES } from "./badges";

type Feedback = { purchasedSize: string; outcome: string; review: string | null };
type Item = {
  id: string; createdAt: string; brand: string; isDemo: boolean; category: string; product: string | null; fitPreference: string;
  recommendedSize: string | null; score: number | null; insufficientData: boolean; dataStatus: string; feedback: Feedback | null;
};
const OUTCOMES = [{ v: "TOO_TIGHT", l: "Too tight" }, { v: "PERFECT", l: "Perfect" }, { v: "TOO_LOOSE", l: "Too loose" }] as const;
const outcomeLabel = (v: string) => OUTCOMES.find((o) => o.v === v)?.l ?? v;

export function HistoryClient({ items }: { items: Item[] }) {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Feedback>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>, item: Item) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { recommendationId: item.id, purchasedSize: String(f.get("size") ?? "").trim(), outcome: String(f.get("outcome") ?? ""), review: String(f.get("review") ?? "").trim() || undefined };
    if (!body.purchasedSize) { setErr("Enter the size you bought."); return; }
    if (!body.outcome) { setErr("Choose how it fit."); return; }
    setBusy(true); setErr(null);
    try {
      await api("/api/feedback", { method: "POST", json: body });
      setLocal((d) => ({ ...d, [item.id]: { purchasedSize: body.purchasedSize, outcome: body.outcome, review: body.review ?? null } }));
      setOpen(null); toast("success", "Fit report saved. Thank you.");
    } catch (error) { setErr(error instanceof ClientError ? error.message : "We couldn’t save your report. Try again."); }
    setBusy(false);
  }

  return (
    <ul className="border-t border-line">
      {items.map((i) => {
        const fb = local[i.id] ?? i.feedback;
        const editing = open === i.id;
        return (
          <li key={i.id} className="border-b border-line py-6">
            <div className="grid sm:grid-cols-[1fr_auto_auto] gap-x-8 gap-y-3 items-start">
              <div className="min-w-0">
                <p className="font-display text-d-sm">{i.brand}</p>
                <p className="mt-1 text-sm text-muted">{i.product ?? i.category}, {FIT_NAMES[i.fitPreference].toLowerCase()} fit, saved {new Date(i.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="mt-2"><DataBadge status={i.dataStatus} demo={i.isDemo} /></div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted">We predicted</p>
                <p className="font-display text-d-md leading-none mt-1">{i.recommendedSize ?? "None"}</p>
              </div>
              <div className="text-left sm:text-right sm:min-w-[9rem]">
                <p className="text-xs text-muted">You reported</p>
                {fb ? <p className="mt-1.5"><span className="font-medium">Size {fb.purchasedSize}</span><span className={`block text-sm ${fb.outcome === "PERFECT" ? "text-good" : "text-warn"}`}>{outcomeLabel(fb.outcome)}</span></p>
                  : <p className="mt-1.5 text-sm text-muted">Nothing yet</p>}
              </div>
            </div>
            {!editing && i.recommendedSize && (
              <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => { setOpen(i.id); setErr(null); }}>{fb ? "Change my report" : "Report how it fit"}</button>
            )}
            {editing && (
              <form onSubmit={(e) => submit(e, i)} className="mt-5 grid gap-5 sm:grid-cols-[10rem_1fr] max-w-2xl border-t border-line pt-5" noValidate>
                <div><label className="label" htmlFor={`s-${i.id}`}>Size you bought</label><input id={`s-${i.id}`} name="size" className="input" defaultValue={fb?.purchasedSize ?? i.recommendedSize ?? ""} required maxLength={20} /></div>
                <fieldset><legend className="label">How did it fit?</legend>
                  <div className="seg" role="radiogroup">
                    {OUTCOMES.map((o) => (
                      <label key={o.v} className="cursor-pointer">
                        <input type="radio" name="outcome" value={o.v} defaultChecked={fb?.outcome === o.v} className="peer sr-only" />
                        <span className="block rounded-[2px] px-3.5 py-1.5 text-sm text-muted peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary">{o.l}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2"><label className="label" htmlFor={`r-${i.id}`}>Notes <span className="text-muted font-normal">(optional, only you and the FITSYNC team see this)</span></label><textarea id={`r-${i.id}`} name="review" defaultValue={fb?.review ?? ""} className="input !h-24 py-2.5" maxLength={1000} placeholder="For example: fine on the chest, sleeves a little long." /></div>
                {err && <p role="alert" className="sm:col-span-2 field-error !mt-0">{err}</p>}
                <div className="sm:col-span-2 flex gap-2"><button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Save report</button><button type="button" className="btn btn-quiet" onClick={() => setOpen(null)}>Cancel</button></div>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
