"use client";
import { useState } from "react";
import { ConfirmDialog } from "../confirm-dialog";
import { DIM_NAMES } from "../badges";
import { useAdminAction } from "./shared";

export type VersionLite = { id: string; status: string; ambiguous: string[]; dims: string[]; semantics: Record<string, string>; measurementType: string; label: string };
type Decision = "APPROVE" | "REJECT" | "FLAG" | "DEPRECATE";
const COPY: Record<Decision, { title: string; label: string; tone: "danger" | "primary"; body: string }> = {
  APPROVE: { title: "Approve and verify this chart?", label: "Approve", tone: "primary", body: "Confirm you compared every row with the source. Verified charts give non-provisional results." },
  REJECT: { title: "Reject this chart?", label: "Reject", tone: "danger", body: "It becomes invalid and is never used. History is kept." },
  FLAG: { title: "Send back for review?", label: "Flag for review", tone: "primary", body: "It stops being used until someone resolves the problem you describe." },
  DEPRECATE: { title: "Retire this chart version?", label: "Retire", tone: "danger", body: "It stops being used for recommendations, for example because the brand published a new guide." },
};
const OPTIONS = [
  ["BODY_CIRCUMFERENCE", "Body circumference"], ["BODY_LINEAR", "Body length or width"],
  ["GARMENT_CIRCUMFERENCE", "Garment circumference"], ["GARMENT_LINEAR", "Garment length or width"], ["GARMENT_WIDTH_FLAT", "Garment width laid flat (half)"],
] as const;

export function VersionActions({ v }: { v: VersionLite }) {
  const { busy, act, api } = useAdminAction();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [resolve, setResolve] = useState(false);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [convert, setConvert] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  // Same rule as the engine: explicit per-dimension meaning, else the chart-level type; UNKNOWN/MIXED means unresolved.
  const open = v.dims.filter((d) => v.ambiguous.includes(d) || (v.semantics[d] ? ["AMBIGUOUS", "GARMENT_WIDTH_FLAT"].includes(v.semantics[d]) : !["BODY", "GARMENT"].includes(v.measurementType)));
  const usable = !["DEPRECATED", "INVALID"].includes(v.status);
  const hasFlat = Object.values(choice).includes("GARMENT_WIDTH_FLAT") || Object.values(v.semantics).includes("GARMENT_WIDTH_FLAT");
  return (
    <div className="flex flex-wrap gap-1.5">
      <a className="btn btn-quiet btn-sm" href={`/api/admin/size-charts/${v.id}/csv`} target="_blank" rel="noopener">CSV</a>
      {usable && v.status !== "VERIFIED" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDecision("APPROVE"); setNote(""); }}>Approve</button>}
      {usable && open.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResolve(true); setChoice({}); setConvert(false); setResolveNote(""); }}>Resolve meaning</button>}
      {usable && v.status !== "NEEDS_HUMAN_VERIFICATION" && <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setDecision("FLAG"); setNote(""); }}>Flag</button>}
      {usable && <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setDecision("REJECT"); setNote(""); }}>Reject</button>}
      {usable && <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setDecision("DEPRECATE"); setNote(""); }}>Retire</button>}

      <ConfirmDialog open={!!decision} title={decision ? COPY[decision].title : ""} tone={decision ? COPY[decision].tone : "primary"} confirmLabel={decision ? COPY[decision].label : ""} busy={busy === v.id}
        confirmDisabled={decision !== "APPROVE" && note.trim().length < 3} onClose={() => setDecision(null)}
        onConfirm={() => decision && act(v.id, () => api(`/api/admin/size-charts/${v.id}`, { method: "PUT", json: { action: decision, note: note.trim() || undefined } }), "Decision saved").then((r) => r && setDecision(null))}>
        <p>{v.label}</p><p>{decision && COPY[decision].body}</p>
        <div><label className="label !text-ink" htmlFor={`n-${v.id}`}>{decision === "APPROVE" ? "Note (optional)" : "Reason (required, saved to the audit log)"}</label><textarea id={`n-${v.id}`} className="input !h-20 py-2" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
      </ConfirmDialog>

      <ConfirmDialog open={resolve} title="What does each measurement describe?" tone="primary" confirmLabel="Save as new version" busy={busy === `r${v.id}`}
        confirmDisabled={resolveNote.trim().length < 3 || !Object.keys(choice).length} onClose={() => setResolve(false)}
        onConfirm={() => act(`r${v.id}`, () => api(`/api/admin/size-charts/${v.id}/edit`, { method: "POST", json: { resolveSemantics: choice, convertFlatToCircumference: convert || undefined, note: resolveNote.trim() } }), "Saved as a new unverified version").then((r) => r && setResolve(false))}>
        <p>Answer only from what the source says. Saving creates a new unverified version; the old one stays in history.</p>
        {open.map((d) => (
          <div key={d}><label className="label !text-ink" htmlFor={`s-${v.id}-${d}`}>{DIM_NAMES[d] ?? d}</label>
            <select id={`s-${v.id}-${d}`} className="input" value={choice[d] ?? ""} onChange={(e) => setChoice((c) => { const n = { ...c }; if (e.target.value) n[d] = e.target.value; else delete n[d]; return n; })}>
              <option value="">Leave unresolved</option>{OPTIONS.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
            </select></div>
        ))}
        {hasFlat && <label className="flex gap-2 items-start text-ink"><input type="checkbox" className="mt-1" checked={convert} onChange={(e) => setConvert(e.target.checked)} /><span>Convert flat widths (chest, waist, hips, thigh) to circumference by doubling. Recorded in the version note.</span></label>}
        <div><label className="label !text-ink" htmlFor={`rn-${v.id}`}>Where the source says this (required)</label><input id={`rn-${v.id}`} className="input" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} maxLength={500} placeholder="e.g. Listing footnote: “Garment measurements in cm”" /></div>
      </ConfirmDialog>
    </div>
  );
}
