"use client";
import { useEffect, useRef } from "react";

/**
 * Accessible confirmation for destructive actions, built on the native <dialog> element
 * (focus is trapped and Escape closes it). The confirm button is never focused by default.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = "danger", busy, onConfirm, onClose, confirmDisabled }: {
  open: boolean; title: string; children?: React.ReactNode; confirmLabel: string; tone?: "danger" | "primary"; busy?: boolean;
  onConfirm: () => void; onClose: () => void; confirmDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-labelledby="confirm-title"
      className="w-[min(30rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-0 text-ink backdrop:bg-ink/40">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); onConfirm(); }} className="p-6">
        <h2 id="confirm-title" className="display-sm">{title}</h2>
        <div className="mt-3 text-sm text-muted space-y-3">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>Cancel</button>
          <button type="submit" className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`} disabled={busy || confirmDisabled}>{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
