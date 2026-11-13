import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { cookieSecure } from "./env";
import { randomToken, sha256 } from "./security/crypto";
import { ipHashOf, userAgentOf } from "./security/request-meta";
import { LEGACY_SESSION_COOKIE, sessionCookieName } from "./security/cookie-names";

/**
 * Revocable server-side sessions.
 * - The cookie holds 256 random bits; the database stores only SHA-256(token). A leaked database row cannot be replayed.
 * - Absolute lifetime 30 days; idle timeout 7 days (lastSeenAt is refreshed at most every 10 minutes).
 * - Logout, "log out everywhere", password reset/change and account disabling revoke sessions immediately.
 * - Legacy V3 JWT cookies are not accepted (they could not be revoked); holders are simply asked to log in again.
 */
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, TOUCH_EVERY_MS, isSessionUsable } from "./session-policy";
export { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, isSessionUsable };

export type SessionUser = { id: string; email: string; name: string | null; role: "USER" | "ADMIN"; emailVerifiedAt: Date | null };
export type SessionState =
  | { status: "active"; sessionId: string; user: SessionUser }
  | { status: "none" }
  | { status: "expired" };

const readToken = () => cookies().get(sessionCookieName())?.value;

/** Resolve the current request's session (memoised per request). Disabled accounts never resolve. */
export const getSession = cache(async (): Promise<SessionState> => {
  const token = readToken();
  if (!token || token.length > 200) return { status: "none" };
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true, disabledAt: true } } },
  });
  if (!s || !isSessionUsable(s) || s.user.disabledAt) return { status: "expired" };
  if (Date.now() - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const { disabledAt: _d, ...user } = s.user;
  return { status: "active", sessionId: s.id, user };
});

/**
 * Everything a new session row needs except its user, computed BEFORE any database write. Anything that can fail
 * here (for example a missing AUTH_SECRET when hashing the IP) then fails before an account is created.
 */
export function prepareSession(headers: Headers) {
  const token = randomToken();
  const now = new Date();
  return {
    token,
    data: { tokenHash: sha256(token), expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS), lastSeenAt: now, userAgent: userAgentOf(headers), ipHash: ipHashOf(headers) },
  };
}

/** Revoke the session cookie sent with this request, if any (rotation on login / registration). */
export async function revokePresentedSession() {
  const previous = readToken();
  if (previous) await db.session.updateMany({ where: { tokenHash: sha256(previous), revokedAt: null }, data: { revokedAt: new Date() } });
}

export function setSessionCookie(token: string) {
  cookies().set(sessionCookieName(), token, {
    httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
  cookies().delete(LEGACY_SESSION_COOKIE);
}

/** Create a session for userId and set the cookie. Any session presented with this request is revoked (rotation). */
export async function startSession(userId: string, headers: Headers) {
  const prepared = prepareSession(headers);
  await revokePresentedSession();
  const session = await db.session.create({ data: { ...prepared.data, userId } });
  setSessionCookie(prepared.token);
  return session;
}

/** Revoke the session presented with this request and clear the cookie. */
export async function endCurrentSession() {
  const token = readToken();
  if (token) await db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  clearSessionCookies();
}

export function clearSessionCookies() {
  cookies().delete(sessionCookieName());
  cookies().delete(LEGACY_SESSION_COOKIE);
}

export const revokeAllSessions = (userId: string, exceptSessionId?: string) =>
  db.session.updateMany({ where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) }, data: { revokedAt: new Date() } });
