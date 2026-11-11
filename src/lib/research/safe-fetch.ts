import { assertPublicHost, UnsafeUrlError, validateResearchUrl, type Resolver } from "./url-safety";
import type { PageResult } from "./types";

export const RESEARCH_UA = "FITSYNC-Research/1.0 (size-chart research; respects robots.txt)";
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const BLOCK_MARKERS = /captcha|are you a robot|access denied|unusual traffic|verify you are human|attention required/i;

type Opts = { fetchImpl?: typeof fetch; resolver?: Resolver; allow?: string[]; checkRobots?: boolean };

function robotsAllows(robots: string, path: string): boolean {
  // Minimal parser: honour Disallow rules for "*" and for our UA token.
  let applies = false; const dis: string[] = [], allow: string[] = [];
  for (const raw of robots.split("\n")) {
    const line = raw.split("#")[0].trim(); const i = line.indexOf(":"); if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
    if (k === "user-agent") applies = v === "*" || RESEARCH_UA.toLowerCase().startsWith(v.toLowerCase());
    else if (applies && k === "disallow" && v) dis.push(v);
    else if (applies && k === "allow" && v) allow.push(v);
  }
  const hit = (rules: string[]) => rules.filter((r) => path.startsWith(r)).sort((a, b) => b.length - a.length)[0];
  const d = hit(dis), a = hit(allow);
  return !d || (!!a && a.length >= d.length);
}

/**
 * Fetch a public page politely and safely. Never follows redirects blindly, never talks to non-public hosts,
 * honours robots.txt, and never tries to get around blocks (401/403/429/CAPTCHA => ACCESS_RESTRICTED).
 */
export async function fetchPage(rawUrl: string, o: Opts = {}): Promise<PageResult> {
  const f = o.fetchImpl ?? fetch;
  let url: URL;
  try {
    url = validateResearchUrl(rawUrl, o.allow);
    await assertPublicHost(url.hostname, o.resolver);
  } catch (e) {
    return { ok: false, status: "ACCESS_RESTRICTED", reason: e instanceof UnsafeUrlError ? e.message : "URL rejected." };
  }
  try {
    if (o.checkRobots !== false) {
      const r = await f(new URL("/robots.txt", url).toString(), { headers: { "user-agent": RESEARCH_UA }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" }).catch(() => null);
      if (r?.ok && !robotsAllows(await r.text(), url.pathname)) return { ok: false, status: "ACCESS_RESTRICTED", reason: "robots.txt disallows this path." };
    }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await f(url.toString(), { headers: { "user-agent": RESEARCH_UA, accept: "text/html,text/plain" }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location"); if (!loc) return { ok: false, status: "SOURCE_UNAVAILABLE", httpStatus: res.status, reason: "Redirect without location." };
        url = validateResearchUrl(new URL(loc, url).toString(), o.allow); await assertPublicHost(url.hostname, o.resolver); continue; // every hop re-validated
      }
      if ([401, 403, 407, 429].includes(res.status)) return { ok: false, status: "ACCESS_RESTRICTED", httpStatus: res.status, reason: `Site refused automated access (HTTP ${res.status}). Not bypassed.` };
      if (!res.ok) return { ok: false, status: "SOURCE_UNAVAILABLE", httpStatus: res.status, reason: `HTTP ${res.status}.` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/(html|plain)|application\/xhtml/.test(type)) return { ok: false, status: "SOURCE_UNAVAILABLE", httpStatus: res.status, reason: `Unsupported content type: ${type || "unknown"}.` };
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAX_BYTES) return { ok: false, status: "SOURCE_UNAVAILABLE", httpStatus: res.status, reason: "Page too large." };
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) return { ok: false, status: "SOURCE_UNAVAILABLE", httpStatus: res.status, reason: "Page too large." };
      const body = new TextDecoder().decode(buf);
      if (BLOCK_MARKERS.test(body.slice(0, 5000)) && body.length < 20000) return { ok: false, status: "ACCESS_RESTRICTED", httpStatus: res.status, reason: "Page looks like a bot-check/CAPTCHA. Not bypassed." };
      return { ok: true, status: res.status, body, finalUrl: url.toString() };
    }
    return { ok: false, status: "SOURCE_UNAVAILABLE", reason: "Too many redirects." };
  } catch (e) {
    if (e instanceof UnsafeUrlError) return { ok: false, status: "ACCESS_RESTRICTED", reason: e.message };
    return { ok: false, status: "SOURCE_UNAVAILABLE", reason: "Network error or timeout." };
  }
}
