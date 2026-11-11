import type { SourceAdapter } from "../types";
import { htmlTableAdapter } from "./html-table";
import { marketplaceListingAdapter } from "./marketplace-listing";

// Pluggable: add a new adapter here for a new site/format. Order matters (first match wins).
export const ADAPTERS: SourceAdapter[] = [marketplaceListingAdapter, htmlTableAdapter];

export function adapterFor(host: string): SourceAdapter | null {
  const h = host.toLowerCase();
  return ADAPTERS.find((a) => a.domains.some((d) => h === d || h.endsWith("." + d))) ?? null;
}
