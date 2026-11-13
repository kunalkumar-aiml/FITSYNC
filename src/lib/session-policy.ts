/** Pure session lifetime rules (no request or database access), shared by session.ts and tests. */
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const TOUCH_EVERY_MS = 10 * 60 * 1000;

export function isSessionUsable(s: { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null }, now = Date.now()) {
  return !s.revokedAt && s.expiresAt.getTime() > now && now - s.lastSeenAt.getTime() < SESSION_IDLE_MS;
}
