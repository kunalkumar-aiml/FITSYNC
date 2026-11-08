"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";

export function SettingsClient({ email }: { email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast("error", e instanceof ClientError ? e.message : "Something went wrong."); }
    setBusy(null);
  }
  return (
    <div className="container-x py-8 sm:py-12 max-w-2xl space-y-5">
      <h1 className="text-3xl sm:text-4xl font-semibold">Settings</h1>
      <section className="card p-6"><h2 className="font-semibold">Account</h2><p className="mt-1 text-sm text-muted">{email}</p></section>
      <section className="card p-6">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">Your measurements are private. Download everything we hold about you, or delete your measurements while keeping your account.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn btn-ghost" href="/api/profile/export" download><Download size={16} />Download my data</a>
          <button className="btn btn-ghost" disabled={busy === "m"} onClick={() => window.confirm("Delete all your saved measurements?") && run("m", async () => { await api("/api/measurements", { method: "DELETE" }); toast("success", "Measurements deleted"); router.refresh(); })}>
            {busy === "m" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}Delete measurements</button>
        </div>
      </section>
      <section className="card p-6 border-bad/40">
        <h2 className="font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Permanently removes your account, measurements, saved recommendations and feedback. This can’t be undone.</p>
        <label className="label mt-4" htmlFor="del">Type DELETE to confirm</label>
        <input id="del" className="input max-w-48" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        <button className="btn mt-3 bg-bad text-white" disabled={confirm !== "DELETE" || busy === "a"}
          onClick={() => run("a", async () => { await api("/api/profile", { method: "DELETE" }); router.push("/"); router.refresh(); })}>
          {busy === "a" && <Loader2 size={16} className="animate-spin" />}Delete my account</button>
      </section>
    </div>
  );
}
