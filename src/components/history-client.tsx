"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { DataBadge, FIT_NAMES } from "./badges";

type Item = {
  id: string; createdAt: string; brand: string; isDemo: boolean; category: string; fitPreference: string;
  recommendedSize: string | null; confidence: number | null; insufficientData: boolean; dataStatus: string;
  feedback: { purchasedSize: string; outcome: string } | null;
};
const OUTCOMES = [{ v: "TOO_TIGHT", l: "Too tight" }, { v: "PERFECT", l: "Perfect" }, { v: "TOO_LOOSE", l: "Too loose" }];

export function HistoryClient({ items }: { items: Item[] }) {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, { purchasedSize: string; outcome: string }>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>, item: Item) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { recommendationId: item.id, purchasedSize: String(f.get("size") ?? ""), outcome: String(f.get("outcome") ?? ""), review: String(f.get("review") ?? "") || undefined };
    if (!body.outcome) { toast("error", "Tell us how it fit."); return; }
    setBusy(true);
    try {
      await api("/api/feedback", { method: "POST", json: body });
      setDone((d) => ({ ...d, [item.id]: { purchasedSize: body.purchasedSize, outcome: body.outcome } }));
      setOpen(null); toast("success", "Thanks. This helps improve future recommendations.");
    } catch (err) { toast("error", err instanceof ClientError ? err.message : "Couldn’t send feedback."); }
    setBusy(false);
  }

  return (
    <ul className="mt-6 space-y-3">
      {items.map((i) => {
        const fb = i.feedback ?? done[i.id];
        return (
          <li key={i.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{i.brand}</div>
                <div className="text-sm text-muted">{i.category} · {FIT_NAMES[i.fitPreference]} · {new Date(i.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              </div>
              <div className="flex items-center gap-3"><DataBadge status={i.dataStatus} demo={i.isDemo} /><div className="text-right"><div className="text-xs text-muted">Predicted</div><div className="text-2xl font-semibold leading-none">{i.recommendedSize ?? "–"}</div></div></div>
            </div>
            {fb ? (
              <p className="mt-3 text-sm text-muted border-t border-line pt-3">You bought <strong className="text-ink">{fb.purchasedSize}</strong> and it fit: <strong className="text-ink">{OUTCOMES.find((o) => o.v === fb.outcome)?.l.toLowerCase()}</strong>.</p>
            ) : i.recommendedSize && open !== i.id ? (
              <button className="btn btn-ghost !h-9 mt-3" onClick={() => setOpen(i.id)}>Report how it fit</button>
            ) : open === i.id ? (
              <form onSubmit={(e) => submit(e, i)} className="mt-4 border-t border-line pt-4 space-y-4">
                <div><label className="label" htmlFor={`s-${i.id}`}>Size you bought</label><input id={`s-${i.id}`} name="size" className="input max-w-32" defaultValue={i.recommendedSize ?? ""} required maxLength={20} /></div>
                <fieldset><legend className="label">How did it fit?</legend>
                  <div className="flex flex-wrap gap-2">{OUTCOMES.map((o) => <label key={o.v} className="cursor-pointer"><input type="radio" name="outcome" value={o.v} className="peer sr-only" /><span className="inline-block rounded-full border border-line px-4 py-2 text-sm peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 ring-accent">{o.l}</span></label>)}</div></fieldset>
                <div><label className="label" htmlFor={`r-${i.id}`}>Anything else? <span className="text-muted font-normal">(optional)</span></label><textarea id={`r-${i.id}`} name="review" className="input !h-24 py-2.5" maxLength={1000} /></div>
                <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Send feedback</button><button type="button" className="btn btn-quiet" onClick={() => setOpen(null)}>Cancel</button></div>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
