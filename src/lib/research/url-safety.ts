import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/** Hostnames FITSYNC's research pipeline may fetch. Anything else is refused (SSRF defence in depth). */
export const ALLOWED_RESEARCH_DOMAINS = [
  // brand-owned sites
  "nike.com", "adidas.co.in", "adidas.com", "puma.com", "in.puma.com", "uniqlo.com", "hm.com", "zara.com", "levi.com", "levi.in",
  "bewakoof.com", "snitch.com", "thesouledstore.com", "maxfashion.in", "westside.com", "savana.com",
  // marketplaces (product listings only)
  "myntra.com", "flipkart.com", "nykaaman.com",
];

export class UnsafeUrlError extends Error {}

const BAD_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    if (x.startsWith("::ffff:")) return isPrivateIp(x.slice(7)); // IPv4-mapped
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff");
  }
  return true; // not an IP -> treated as unsafe here
}

export function hostAllowed(host: string, allow = ALLOWED_RESEARCH_DOMAINS): boolean {
  const h = host.toLowerCase();
  return allow.some((d) => h === d || h.endsWith("." + d));
}

/** Pure, synchronous validation of the URL text. DNS is checked separately in assertPublicHost. */
export function validateResearchUrl(raw: string, allow = ALLOWED_RESEARCH_DOMAINS): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UnsafeUrlError("Not a valid URL."); }
  if (u.protocol !== "https:") throw new UnsafeUrlError("Only https:// URLs are allowed.");
  if (u.username || u.password) throw new UnsafeUrlError("URLs with credentials are not allowed.");
  if (u.port && u.port !== "443") throw new UnsafeUrlError("Non-standard ports are not allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) throw new UnsafeUrlError("IP addresses are not allowed; use a hostname.");
  if (host === "localhost" || !host.includes(".") || BAD_SUFFIXES.some((s) => host.endsWith(s))) throw new UnsafeUrlError("Internal hostnames are not allowed.");
  if (!hostAllowed(host, allow)) throw new UnsafeUrlError(`${host} is not an allowed research source.`);
  if (raw.length > 2000) throw new UnsafeUrlError("URL is too long.");
  return u;
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

/** Resolve DNS and require EVERY address to be public (blocks DNS pointing at internal hosts). */
export async function assertPublicHost(host: string, resolve: Resolver = defaultResolver) {
  let addrs: string[];
  try { addrs = await resolve(host); } catch { throw new UnsafeUrlError("Host could not be resolved."); }
  if (!addrs.length || addrs.some(isPrivateIp)) throw new UnsafeUrlError("Host resolves to a non-public address.");
}
