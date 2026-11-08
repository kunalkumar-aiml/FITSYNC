import { BadgeCheck, FlaskConical, TriangleAlert } from "lucide-react";
import type { FitLabel } from "@/lib/engine";

export function DataBadge({ status, demo }: { status: string; demo?: boolean }) {
  if (demo) return <span className="chip border-warn/50 text-warn"><FlaskConical size={12} />Demo data</span>;
  if (status === "VERIFIED") return <span className="chip border-good/50 text-good"><BadgeCheck size={12} />Verified</span>;
  return <span className="chip border-warn/50 text-warn"><TriangleAlert size={12} />Unverified</span>;
}

export function FitChip({ label }: { label: FitLabel }) {
  const tone = label === "Good" ? "text-good border-good/50 bg-good/10" : label.includes("Slightly") ? "text-warn border-warn/50 bg-warn/10" : "text-bad border-bad/50 bg-bad/10";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

export const FIT_NAMES: Record<string, string> = { SLIM: "Slim", REGULAR: "Regular", RELAXED: "Relaxed", OVERSIZED: "Oversized" };
export const DIM_NAMES: Record<string, string> = {
  chest: "Chest", waist: "Waist", hips: "Hips", shoulder: "Shoulders", armLength: "Arm length", inseam: "Inseam", neck: "Neck", thigh: "Thigh",
};
