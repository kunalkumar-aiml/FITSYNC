"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ClientError } from "@/lib/client";
import { Notice } from "./ui";

export function VerifyBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "warn" | "error"; text: string } | null>(null);
  async function resend() {
    setBusy(true);
    try {
      const r = await api<{ delivery: string; message: string }>("/api/auth/verify-email/resend", { method: "POST" });
      setMsg({ tone: r.delivery === "unavailable" ? "warn" : "success", text: r.message });
    } catch (e) { setMsg({ tone: "error", text: e instanceof ClientError ? e.message : "Couldn’t send. Try again later." }); }
    setBusy(false);
  }
  return (
    <Notice tone="warn" title="Confirm your email address">
      <p>We use {email} to recover your account. Confirming it protects you if you forget your password.</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={resend} disabled={busy} className="btn btn-ghost btn-sm">{busy && <Loader2 size={14} className="animate-spin" />}Send confirmation link</button>
        {msg && <span role="status" className={msg.tone === "error" ? "text-bad" : "text-ink"}>{msg.text}</span>}
      </div>
    </Notice>
  );
}
