import { BadgeCheck, Clock, FlaskConical, TriangleAlert, Ban } from "lucide-react";
import type { FitLabel } from "@/lib/engine";

const DATA: Record<string, { label: string; cls: string; icon: typeof BadgeCheck; title: string }> = {
  VERIFIED: { label: "Verified", cls: "border-good/40 text-good", icon: BadgeCheck, title: "A person checked this chart against its source." },
  UNVERIFIED: { label: "Unverified", cls: "border-warn/40 text-warn", icon: TriangleAlert, title: "Collected from the source but not yet checked by a person. Results are provisional." },
  NEEDS_HUMAN_VERIFICATION: { label: "Awaiting review", cls: "border-warn/40 text-warn", icon: Clock, title: "Something in this chart needs a person to look at it. Not used for recommendations." },
  INVALID: { label: "Rejected", cls: "border-bad/40 text-bad", icon: Ban, title: "Rejected as wrong. Never used." },
  DEPRECATED: { label: "Retired", cls: "border-line text-muted", icon: Ban, title: "Replaced or withdrawn. Never used." },
};

export function DataBadge({ status, demo }: { status: string; demo?: boolean }) {
  if (demo) return <span className="tag border-warn/40 text-warn" title="Made-up numbers for trying FITSYNC. Not a real brand."><FlaskConical size={12} aria-hidden />Sample data</span>;
  const d = DATA[status] ?? DATA.UNVERIFIED;
  return <span className={`tag ${d.cls}`} title={d.title}><d.icon size={12} aria-hidden />{d.label}</span>;
}

export function FitChip({ label }: { label: FitLabel }) {
  const tone = label === "Good" ? "text-good border-good/40" : label.includes("Slightly") ? "text-warn border-warn/40" : "text-bad border-bad/40";
  return <span className={`tag ${tone}`}>{label}</span>;
}

export const FIT_NAMES: Record<string, string> = { SLIM: "Slim", REGULAR: "Regular", RELAXED: "Relaxed", OVERSIZED: "Oversized", UNKNOWN: "Not stated" };
export const GENDER_NAMES: Record<string, string> = { MEN: "Men’s", WOMEN: "Women’s", UNISEX: "Unisex" };
export const DIM_NAMES: Record<string, string> = {
  chest: "Chest", waist: "Waist", hips: "Hips", shoulder: "Shoulders", armLength: "Arm length", inseam: "Inseam", neck: "Neck", thigh: "Thigh",
  garmentLength: "Garment length", sleeveLength: "Sleeve length", rise: "Rise", legOpening: "Leg opening",
};
export const SOURCE_NAMES: Record<string, string> = {
  OFFICIAL_SITE: "Brand’s size guide", OFFICIAL_PDF: "Brand’s PDF guide", OFFICIAL_PRODUCT_PAGE: "Brand’s product page",
  MARKETPLACE_LISTING: "Marketplace listing", STORE_MEASURED: "Measured in store", MANUAL_ENTRY: "Entered by FITSYNC", DEMO: "Sample data",
};
