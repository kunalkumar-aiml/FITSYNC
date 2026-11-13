import { keyedHash } from "./crypto";

/**
 * Client IP for rate limiting and security logs.
 * Proxy headers are client-controlled unless a trusted proxy overwrites them, so they are only read when the deployment
 * says a trusted proxy is in front: on Vercel (which sets x-real-ip / x-forwarded-for itself) or when TRUST_PROXY=true.
 * Otherwise every request is "unknown" and limits fall back to per-account keys.
 */
export function clientIp(headers: Headers): string {
  const trusted = process.env.VERCEL === "1" || process.env.TRUST_PROXY === "true";
  if (!trusted) return "unknown";
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export const ipHashOf = (headers: Headers) => {
  const ip = clientIp(headers);
  return ip === "unknown" ? null : keyedHash(`ip:${ip}`);
};

export const userAgentOf = (headers: Headers) => headers.get("user-agent")?.slice(0, 200) ?? null;

/** "Chrome on macOS" style label for the Settings device list. Best-effort, never used for security decisions. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /node|undici|curl/i.test(ua) ? "Script" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
