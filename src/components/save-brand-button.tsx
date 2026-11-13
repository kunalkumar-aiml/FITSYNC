"use client";
import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "./toast";

export function SaveBrandButton({ slug, initial }: { slug: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/brands/${slug}/save`, { method: saved ? "DELETE" : "PUT" });
      setSaved(!saved);
      toast("success", saved ? "Removed from saved brands" : "Saved to your brands");
    } catch { toast("error", "Couldn’t update saved brands. Try again."); }
    setBusy(false);
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} className="btn btn-ghost">
      {saved ? <BookmarkCheck size={16} strokeWidth={1.6} /> : <Bookmark size={16} strokeWidth={1.6} />}{saved ? "Saved" : "Save brand"}
    </button>
  );
}
