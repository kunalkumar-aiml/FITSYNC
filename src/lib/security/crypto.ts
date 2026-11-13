import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { authSecret } from "../env";

/** 256-bit random token, URL-safe. Used for session cookies and email tokens. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Tokens are stored only as their SHA-256 hash, so a database leak does not leak usable sessions or links. */
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Keyed hash for low-sensitivity identifiers (IP addresses, rate-limit keys). Not reversible without AUTH_SECRET. */
export const keyedHash = (s: string) => createHmac("sha256", Buffer.from(authSecret())).update(s).digest("hex").slice(0, 32);

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
