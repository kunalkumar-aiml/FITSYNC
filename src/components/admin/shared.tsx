"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ClientError } from "@/lib/client";
import { useToast } from "../toast";

/** Run an admin mutation with a busy flag, a toast and a refresh of the server-rendered data. */
export function useAdminAction() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function act<T>(key: string, fn: () => Promise<T>, ok: string): Promise<T | null> {
    setBusy(key);
    try { const r = await fn(); toast("success", ok); router.refresh(); return r; }
    catch (e) { toast("error", e instanceof ClientError ? e.message : "That didn’t work. Try again."); return null; }
    finally { setBusy(null); }
  }
  return { busy, act, api };
}

const TONE: Record<string, string> = {
  Verified: "border-good/40 text-good", Unverified: "border-warn/40 text-warn", Missing: "text-muted", Outdated: "border-bad/40 text-bad", "Product-specific": "text-ink",
  SUCCESS: "border-good/40 text-good", PARTIAL_SUCCESS: "border-warn/40 text-warn", NEEDS_HUMAN_VERIFICATION: "border-warn/40 text-warn",
  SOURCE_UNAVAILABLE: "text-muted", ACCESS_RESTRICTED: "border-bad/40 text-bad", INVALID_DATA: "border-bad/40 text-bad",
  COMPLETED: "border-good/40 text-good", FAILED: "border-bad/40 text-bad", RUNNING: "border-warn/40 text-warn", QUEUED: "text-muted",
};
export const Pill = ({ t }: { t: string }) => <span className={`tag ${TONE[t] ?? ""}`}>{t.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>;
