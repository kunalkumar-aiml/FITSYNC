"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const signup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/auth/${signup ? "register" : "login"}`, {
        method: "POST",
        json: { email: f.get("email"), password: f.get("password"), ...(signup && f.get("name") ? { name: f.get("name") } : {}) },
      });
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : signup ? "/profile?welcome=1" : "/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ClientError) { setError(err.message); setFieldErrors((err.details as Record<string, string[]>) ?? {}); }
      else setError("Network problem. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="container-x py-12 sm:py-20 max-w-md">
      <h1 className="text-3xl font-semibold">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-muted">{signup ? "Free. Takes under a minute." : "Log in to see your fit profile."}</p>
      <form onSubmit={onSubmit} className="card mt-8 p-6 space-y-4" noValidate>
        {error && <div role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm">{error}</div>}
        {signup && (
          <div>
            <label className="label" htmlFor="name">Name <span className="text-muted font-normal">(optional)</span></label>
            <input id="name" name="name" className="input" autoComplete="name" maxLength={80} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" inputMode="email" aria-invalid={!!fieldErrors.email} />
          {fieldErrors.email && <p className="mt-1 text-sm text-bad">{fieldErrors.email[0]}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={signup ? 8 : 1} className="input"
            autoComplete={signup ? "new-password" : "current-password"} aria-invalid={!!fieldErrors.password} />
          {fieldErrors.password ? <p className="mt-1 text-sm text-bad">{fieldErrors.password[0]}</p> : signup && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{signup ? "Create account" : "Log in"}</button>
      </form>
      <p className="mt-5 text-sm text-muted text-center">
        {signup ? <>Already have an account? <Link href="/login" className="text-ink underline">Log in</Link></> : <>New to FITSYNC? <Link href="/signup" className="text-ink underline">Create an account</Link></>}
      </p>
      {signup && <p className="mt-3 text-xs text-muted text-center">By signing up you agree to our <Link href="/privacy" className="underline">privacy notice</Link>.</p>}
    </div>
  );
}
