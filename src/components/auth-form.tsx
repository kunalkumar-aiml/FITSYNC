"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "./toast";
import { Notice } from "./ui";

export function PasswordInput({ id, name, autoComplete, invalid, describedBy, required = true }: { id: string; name: string; autoComplete: string; invalid?: boolean; describedBy?: string; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} required={required} className="input pr-11" autoComplete={autoComplete} aria-invalid={invalid || undefined} aria-describedby={describedBy} maxLength={128} />
      <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
        {show ? <EyeOff size={17} strokeWidth={1.6} /> : <Eye size={17} strokeWidth={1.6} />}
      </button>
    </div>
  );
}

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null);

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const signup = mode === "signup";
  const banner = params.get("expired") ? { tone: "warn" as const, text: "Your session ended. Log in again to continue." }
    : params.get("reset") ? { tone: "success" as const, text: "Password changed. Every device was signed out; log in with your new password." }
    : params.get("deleted") ? { tone: "success" as const, text: "Your account and its data were deleted." } : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ verification?: { message: string } }>(`/api/auth/${signup ? "register" : "login"}`, {
        method: "POST",
        json: { email: f.get("email"), password: f.get("password"), ...(signup && f.get("name") ? { name: f.get("name") } : {}) },
      });
      if (signup && r.verification) toast("success", r.verification.message);
      router.push(safeNext(params.get("next")) ?? (signup ? "/profile?welcome=1" : "/dashboard"));
      router.refresh();
    } catch (err) {
      if (err instanceof ClientError) { setError(err.message); setFieldErrors((err.details as Record<string, string[]>) ?? {}); }
      else setError("We couldn’t reach FITSYNC. Check your connection and try again.");
      setBusy(false);
    }
  }

  const fe = (k: string) => fieldErrors[k]?.[0];
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {banner && <Notice tone={banner.tone} role="status">{banner.text}</Notice>}
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {signup && (
        <div>
          <label className="label" htmlFor="name">Name <span className="text-muted font-normal">(optional)</span></label>
          <input id="name" name="name" className="input" autoComplete="given-name" maxLength={80} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" inputMode="email" aria-invalid={!!fe("email") || undefined} aria-describedby={fe("email") ? "email-err" : undefined} maxLength={254} />
        {fe("email") && <p id="email-err" className="field-error">{fe("email")}</p>}
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Password</label>
          {!signup && <Link href="/forgot-password" className="text-sm text-muted hover:text-ink">Forgot password?</Link>}
        </div>
        <PasswordInput id="password" name="password" autoComplete={signup ? "new-password" : "current-password"} invalid={!!fe("password")} describedBy="password-help" />
        {fe("password") ? <p id="password-help" className="field-error">{fe("password")}</p> : signup && <p id="password-help" className="hint">At least 10 characters. A few unrelated words is easy to remember and hard to guess.</p>}
      </div>
      <button className="btn btn-primary w-full h-12" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{signup ? "Create account" : "Log in"}</button>
      {signup && <p className="text-xs text-muted">By creating an account you agree to how we handle data in the <Link href="/privacy" className="link">privacy notice</Link>.</p>}
    </form>
  );
}
