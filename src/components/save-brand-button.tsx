"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { api, ClientError } from "@/lib/client";
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
      toast("success", saved ? "Removed from favourites" : "Saved to favourites");
    } catch (e) { toast("error", e instanceof ClientError ? e.message : "Couldn’t update favourites."); }
    setBusy(false);
  }
  return (
    <button onClick={toggle} disabled={busy} aria-pressed={saved} className="btn btn-ghost">
      <Heart size={16} className={saved ? "fill-accent text-accent" : ""} />{saved ? "Saved" : "Save brand"}
    </button>
  );
}
