"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";
import { PasswordInput } from "./auth-form";
import { VerifyBanner } from "./verify-banner";

type SessionRow = { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean };
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Block({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="grid lg:grid-cols-12 gap-6 border-t border-line py-8">
      <div className="lg:col-span-4"><h2 className="text-lg font-semibold">{title}</h2>{desc && <p className="mt-1.5 text-sm text-muted max-w-xs">{desc}</p>}</div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

export function SettingsClient({ email, name, verified, unit, hasMeasurements, measurementsUpdated, isAdmin }: {
  email: string; name: string | null; verified: boolean; unit: "CM" | "IN"; hasMeasurements: boolean; measurementsUpdated: string | null; isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [dialog, setDialog] = useState<null | "measurements" | "account" | "everywhere">(null);
  const [confirmText, setConfirmText] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<Record<string, string>>({});

  const loadSessions = () => api<SessionRow[]>("/api/auth/sessions").then(setSessions).catch(() => setSessions([]));
  useEffect(() => { loadSessions(); }, []);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast("error", e instanceof ClientError ? e.message : "Something went wrong. Try again."); }
    setBusy(null);
  }

  return (
    <div>
      <Block title="Account" desc="Your sign-in email can’t be changed here yet.">
        {!verified && <div className="mb-6"><VerifyBanner email={email} /></div>}
        <dl className="text-sm"><dt className="text-muted">Email</dt><dd className="mt-1 font-medium">{email} {verified && <span className="tag ml-2 border-good/40 text-good">Confirmed</span>}</dd></dl>
        <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("name") ?? "").trim(); run("name", async () => { await api("/api/profile", { method: "PATCH", json: { name: v || null } }); toast("success", "Name saved"); router.refresh(); }); }}>
          <div className="w-full max-w-xs"><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" defaultValue={name ?? ""} maxLength={80} autoComplete="given-name" /></div>
          <button className="btn btn-ghost" disabled={busy === "name"}>Save name</button>
        </form>
      </Block>

      <Block title="Measurements" desc="Body measurements are private: only you can see them.">
        <p className="text-sm text-muted">{hasMeasurements ? `Last updated ${new Date(measurementsUpdated!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.` : "No measurements saved."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/profile" className="btn btn-ghost">{hasMeasurements ? "Edit measurements" : "Add measurements"}</Link>
          {hasMeasurements && <button type="button" className="btn btn-quiet" onClick={() => setDialog("measurements")}>Delete measurements</button>}
        </div>
        <fieldset className="mt-6">
          <legend className="label">Show measurements in</legend>
          <div className="seg" role="radiogroup">
            {(["CM", "IN"] as const).map((u) => <button key={u} type="button" role="radio" aria-checked={unit === u} className="seg-item" onClick={() => run("unit", async () => { await api("/api/profile", { method: "PATCH", json: { preferredUnit: u } }); router.refresh(); })}>{u === "CM" ? "Centimetres" : "Inches"}</button>)}
          </div>
        </fieldset>
      </Block>

      <Block title="Privacy and your data" desc="Download a copy of everything FITSYNC holds about you, as a JSON file.">
        <a className="btn btn-ghost" href="/api/profile/export" download><Download size={16} strokeWidth={1.6} />Download my data</a>
        <p className="mt-3 text-sm text-muted">Includes your account details, measurements, recommendations, fit reports, saved brands, signed-in devices and security events. <Link className="link" href="/privacy">Read the privacy notice</Link>.</p>
      </Block>

      <Block title="Password" desc="Changing it signs out every other device.">
        <form className="grid gap-4 max-w-sm" onSubmit={(e) => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setPwErr({});
          if (f.get("newPassword") !== f.get("confirm")) { setPwErr({ confirm: "The new passwords don’t match." }); return; }
          run("pw", async () => {
            try {
              const r = await api<{ otherSessionsSignedOut: number }>("/api/auth/password/change", { method: "POST", json: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } });
              form.reset(); toast("success", r.otherSessionsSignedOut ? `Password changed. ${r.otherSessionsSignedOut} other device(s) signed out.` : "Password changed."); loadSessions();
            } catch (err) {
              if (err instanceof ClientError && err.details) { const d = err.details as Record<string, string[]>; setPwErr({ currentPassword: d.currentPassword?.[0] ?? "", newPassword: d.newPassword?.[0] ?? "" }); if (!d.currentPassword && !d.newPassword) throw err; }
              else throw err;
            }
          });
        }} noValidate>
          <div><label className="label" htmlFor="currentPassword">Current password</label><PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" invalid={!!pwErr.currentPassword} />{pwErr.currentPassword && <p className="field-error">{pwErr.currentPassword}</p>}</div>
          <div><label className="label" htmlFor="newPassword">New password</label><PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" invalid={!!pwErr.newPassword} /><p className={pwErr.newPassword ? "field-error" : "hint"}>{pwErr.newPassword || "At least 10 characters."}</p></div>
          <div><label className="label" htmlFor="confirm">Repeat new password</label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={!!pwErr.confirm} />{pwErr.confirm && <p className="field-error">{pwErr.confirm}</p>}</div>
          <div><button className="btn btn-ghost" disabled={busy === "pw"}>{busy === "pw" && <Loader2 size={16} className="animate-spin" />}Change password</button></div>
        </form>
      </Block>

      <Block title="Signed-in devices" desc="Sign out anything you don’t recognise. Sessions end after 7 days without use.">
        {sessions === null ? <div className="skeleton h-24" aria-hidden /> : (
          <ul className="divide-y divide-line border-y border-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-sm">
                <div><p className="font-medium">{s.device}{s.current && <span className="tag ml-2">This device</span>}</p><p className="text-xs text-muted">Signed in {when(s.createdAt)}, last active {when(s.lastSeenAt)}</p></div>
                <button type="button" className="btn btn-quiet btn-sm" disabled={busy === s.id} onClick={() => run(s.id, async () => {
                  const r = await api<{ current: boolean }>(`/api/auth/sessions/${s.id}`, { method: "DELETE" });
                  if (r.current) { router.push("/login"); router.refresh(); return; }
                  toast("success", "Device signed out"); loadSessions();
                })}>Sign out</button>
              </li>
            ))}
            {sessions.length === 0 && <li className="py-3.5 text-sm text-muted">No active sessions found.</li>}
          </ul>
        )}
        <button type="button" className="btn btn-ghost mt-4" onClick={() => setDialog("everywhere")}>Sign out everywhere</button>
      </Block>

      <Block title="Delete account" desc="Permanent. There is no undo.">
        <p className="text-sm text-muted max-w-prose">Removes your account, measurements, recommendations, fit reports, saved brands and sign-in history immediately.{isAdmin ? " Administrators can only delete their account while another administrator exists." : ""}</p>
        <button type="button" className="btn btn-danger mt-4" onClick={() => { setDialog("account"); setConfirmText(""); setDeletePw(""); setDeleteErr(null); }}>Delete my account</button>
      </Block>

      <ConfirmDialog open={dialog === "measurements"} title="Delete your measurements?" confirmLabel="Delete measurements" busy={busy === "m"} onClose={() => setDialog(null)}
        onConfirm={() => run("m", async () => { await api("/api/measurements", { method: "DELETE" }); setDialog(null); toast("success", "Measurements deleted"); router.refresh(); })}>
        <p>Your account and history stay. You’ll need to add measurements again before getting new recommendations.</p>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "everywhere"} title="Sign out everywhere?" tone="primary" confirmLabel="Sign out everywhere" busy={busy === "all"} onClose={() => setDialog(null)}
        onConfirm={() => run("all", async () => { await api("/api/auth/logout-all", { method: "POST" }); router.push("/login"); router.refresh(); })}>
        <p>Every device, including this one, will need to log in again.</p>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "account"} title="Delete your account?" confirmLabel="Delete account permanently" busy={busy === "a"} onClose={() => setDialog(null)}
        confirmDisabled={confirmText !== "DELETE" || !deletePw}
        onConfirm={() => run("a", async () => {
          setDeleteErr(null);
          try { await api("/api/profile", { method: "DELETE", json: { password: deletePw } }); router.push("/login?deleted=1"); router.refresh(); }
          catch (e) { setDeleteErr(e instanceof ClientError ? e.message : "Couldn’t delete the account."); }
        })}>
        <p>This deletes everything immediately and can’t be undone.</p>
        <div><label className="label !text-ink" htmlFor="del-pw">Your password</label><input id="del-pw" type="password" className="input" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} autoComplete="current-password" /></div>
        <div><label className="label !text-ink" htmlFor="del">Type DELETE to confirm</label><input id="del" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></div>
        {deleteErr && <p role="alert" className="field-error">{deleteErr}</p>}
      </ConfirmDialog>
    </div>
  );
}
