"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { Notice } from "./ui";
import { PasswordInput } from "./auth-form";

export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await api<{ message: string }>("/api/auth/password/forgot", { method: "POST", json: { email: new FormData(e.currentTarget).get("email") } }); setDone(r.message); }
    catch (err) { setError(err instanceof ClientError ? err.message : "We couldn’t reach FITSYNC. Try again."); }
    setBusy(false);
  }
  if (done) return <Notice tone="success" role="status" title="Check your inbox">{done}</Notice>;
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" maxLength={254} /></div>
      <button className="btn btn-primary w-full h-12" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Send reset link</button>
    </form>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  if (!token) return <Notice tone="error" title="This link is incomplete">Open the link from your email again, or <Link href="/forgot-password" className="link">request a new one</Link>.</Notice>;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setFieldError(null);
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) { setFieldError("The two passwords don’t match."); return; }
    setBusy(true);
    try { await api("/api/auth/password/reset", { method: "POST", json: { token, password: f.get("password") } }); router.push("/login?reset=1"); }
    catch (err) {
      if (err instanceof ClientError) { const p = (err.details as Record<string, string[]> | undefined)?.password?.[0]; if (p) setFieldError(p); else setError(err.message); }
      else setError("We couldn’t reach FITSYNC. Try again.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && <Notice tone="error" role="alert">{error} <Link href="/forgot-password" className="link">Request a new link</Link></Notice>}
      <div><label className="label" htmlFor="password">New password</label><PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fieldError} describedBy="pw-help" />
        <p id="pw-help" className={fieldError ? "field-error" : "hint"}>{fieldError ?? "At least 10 characters."}</p></div>
      <div><label className="label" htmlFor="confirm">Repeat new password</label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" /></div>
      <button className="btn btn-primary w-full h-12" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Set new password</button>
      <p className="text-xs text-muted">After the change, every device is signed out.</p>
    </form>
  );
}

export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!token) return <Notice tone="error" title="This link is incomplete">Open the link from your email again. You can send a new one from your dashboard.</Notice>;
  async function confirm() {
    setState("busy");
    try { await api("/api/auth/verify-email", { method: "POST", json: { token } }); setState("done"); }
    catch (err) { setError(err instanceof ClientError ? err.message : "We couldn’t reach FITSYNC. Try again."); setState("error"); }
  }
  if (state === "done") return <div className="space-y-5"><Notice tone="success" role="status" title="Email confirmed">Thanks. Your address is now verified.</Notice><Link href="/dashboard" className="btn btn-primary">Go to your dashboard</Link></div>;
  return (
    <div className="space-y-5">
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      <button type="button" className="btn btn-primary w-full h-12" onClick={confirm} disabled={state === "busy"}>{state === "busy" && <Loader2 size={16} className="animate-spin" />}Confirm my email</button>
    </div>
  );
}
