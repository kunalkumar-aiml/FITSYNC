import { ALLOWED_RESEARCH_DOMAINS, hostAllowed, validateResearchUrl } from "./url-safety";

/**
 * Source discovery through a PERMITTED public search API. This is real search, clearly separated from fetching:
 * it only proposes candidate URLs. A person picks which ones to fetch in Admin → Research jobs, and the normal pipeline
 * (allow-list, robots.txt, no bypassing) then fetches them.
 *
 * Providers (set one):
 *  - Brave Search API:            SEARCH_PROVIDER=brave,  BRAVE_SEARCH_API_KEY
 *  - Google Programmable Search:  SEARCH_PROVIDER=google, GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID
 * Without a provider, discovery reports "not configured" and returns nothing. It never invents a URL: every candidate
 * is a result the search API actually returned, filtered to the research allow-list.
 */
export type Candidate = {
  url: string; title: string; host: string;
  kind: "OFFICIAL_SIZE_GUIDE" | "OFFICIAL_PRODUCT_PAGE" | "MARKETPLACE_LISTING" | "OTHER";
  query: string;
};
export type DiscoveryResult = { configured: boolean; provider: string | null; queries: string[]; candidates: Candidate[]; errors: string[] };

/** Brand slug -> its own domains (marketplaces are kept separate: they are never brands). */
export const BRAND_DOMAINS: Record<string, string[]> = {
  zara: ["zara.com"], hm: ["hm.com"], uniqlo: ["uniqlo.com"], levis: ["levi.com", "levi.in"], nike: ["nike.com"],
  adidas: ["adidas.co.in", "adidas.com"], puma: ["puma.com", "in.puma.com"], bewakoof: ["bewakoof.com"], snitch: ["snitch.com"],
  "the-souled-store": ["thesouledstore.com"], "max-fashion": ["maxfashion.in"], westside: ["westside.com"], savana: ["savana.com"],
};
const MARKETPLACES = ["myntra.com", "flipkart.com", "nykaaman.com", "nykaafashion.com"];

const CATEGORY_WORDS: Record<string, string> = {
  tshirt: "t-shirt", shirt: "shirt", hoodie: "hoodie", jeans: "jeans", polo: "polo", sweatshirt: "sweatshirt", jacket: "jacket",
  top: "top", chinos: "chinos", joggers: "joggers", shorts: "shorts", skirt: "skirt", dress: "dress",
};

export function buildQueries(i: { brandName: string; brandSlug: string; category: string; gender: string; productQuery?: string }): string[] {
  const g = i.gender === "MEN" ? "men" : i.gender === "WOMEN" ? "women" : "";
  const what = CATEGORY_WORDS[i.category] ?? i.category;
  const own = BRAND_DOMAINS[i.brandSlug] ?? [];
  const q: string[] = [];
  for (const d of own.slice(0, 2)) q.push(`site:${d} size guide ${g} ${what}`.replace(/\s+/g, " ").trim());
  if (i.productQuery) q.push(`${i.brandName} ${i.productQuery} size chart`.trim());
  if (!own.length) q.push(`${i.brandName} official size guide ${g} ${what}`.replace(/\s+/g, " ").trim());
  return [...new Set(q)].slice(0, 3);
}

export function classify(url: URL, brandSlug: string): Candidate["kind"] {
  const host = url.hostname.toLowerCase();
  const own = BRAND_DOMAINS[brandSlug] ?? [];
  if (MARKETPLACES.some((m) => host === m || host.endsWith("." + m))) return "MARKETPLACE_LISTING";
  if (own.some((d) => host === d || host.endsWith("." + d))) return /size|fit-guide|sizechart|size-chart|size-fit/i.test(url.pathname) ? "OFFICIAL_SIZE_GUIDE" : "OFFICIAL_PRODUCT_PAGE";
  return "OTHER";
}

type Raw = { url: string; title: string };
type Fetch = typeof fetch;

async function searchBrave(q: string, key: string, f: Fetch): Promise<Raw[]> {
  const res = await f(`https://api.search.brave.com/res/v1/web/search?count=10&q=${encodeURIComponent(q)}`, { headers: { accept: "application/json", "x-subscription-token": key }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}`);
  const j = (await res.json()) as { web?: { results?: { url: string; title: string }[] } };
  return (j.web?.results ?? []).map((r) => ({ url: r.url, title: r.title }));
}

async function searchGoogle(q: string, key: string, cx: string, f: Fetch): Promise<Raw[]> {
  const res = await f(`https://www.googleapis.com/customsearch/v1?num=10&key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Google Programmable Search HTTP ${res.status}`);
  const j = (await res.json()) as { items?: { link: string; title: string }[] };
  return (j.items ?? []).map((r) => ({ url: r.link, title: r.title }));
}

export function discoveryProvider(): "brave" | "google" | null {
  const p = process.env.SEARCH_PROVIDER;
  if (p === "brave" && process.env.BRAVE_SEARCH_API_KEY) return "brave";
  if (p === "google" && process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID) return "google";
  return null;
}

export async function discoverSources(
  i: { brandName: string; brandSlug: string; category: string; gender: string; productQuery?: string },
  opts: { fetchImpl?: Fetch; provider?: "brave" | "google" | null } = {},
): Promise<DiscoveryResult> {
  const provider = opts.provider === undefined ? discoveryProvider() : opts.provider;
  const queries = buildQueries(i);
  if (!provider) return { configured: false, provider: null, queries, candidates: [], errors: ["Source discovery is not configured. Set SEARCH_PROVIDER with an API key (see docs/RESEARCH.md), or paste URLs by hand."] };
  const f = opts.fetchImpl ?? fetch;
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const errors: string[] = [];
  for (const q of queries) {
    let raw: Raw[] = [];
    try {
      raw = provider === "brave" ? await searchBrave(q, process.env.BRAVE_SEARCH_API_KEY ?? "", f) : await searchGoogle(q, process.env.GOOGLE_CSE_API_KEY ?? "", process.env.GOOGLE_CSE_ID ?? "", f);
    } catch (e) { errors.push(`${q}: ${(e as Error).message}`); continue; }
    for (const r of raw) {
      let u: URL;
      try { u = validateResearchUrl(r.url, ALLOWED_RESEARCH_DOMAINS); } catch { continue; } // outside the allow-list: dropped
      u.hash = "";
      const key = u.toString();
      if (seen.has(key) || !hostAllowed(u.hostname)) continue;
      seen.add(key);
      candidates.push({ url: key, title: r.title.slice(0, 200), host: u.hostname, kind: classify(u, i.brandSlug), query: q });
    }
  }
  const order = { OFFICIAL_SIZE_GUIDE: 0, OFFICIAL_PRODUCT_PAGE: 1, MARKETPLACE_LISTING: 2, OTHER: 3 };
  candidates.sort((a, b) => order[a.kind] - order[b.kind]);
  return { configured: true, provider, queries, candidates: candidates.slice(0, 25), errors };
}
