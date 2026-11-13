import { db } from "./db";

/**
 * Data retention (documented in docs/PRIVACY.md; the periods are defaults for the business owner to confirm):
 *  - sessions: deleted 30 days after they expired or were revoked
 *  - email / reset tokens: deleted 7 days after expiry or use
 *  - security events (AuthEvent): 180 days
 *  - admin audit log: kept (business record), not touched here
 * User content (measurements, recommendations, feedback) is kept until the user deletes it or the account.
 */
export const RETENTION = { sessionsDays: 30, tokensDays: 7, authEventsDays: 180 } as const;

export async function runRetentionCleanup(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const [sessions, tokens, events] = await Promise.all([
    db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(RETENTION.sessionsDays) } }, { revokedAt: { lt: ago(RETENTION.sessionsDays) } }] } }),
    db.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(RETENTION.tokensDays) } }, { usedAt: { lt: ago(RETENTION.tokensDays) } }] } }),
    db.authEvent.deleteMany({ where: { createdAt: { lt: ago(RETENTION.authEventsDays) } } }),
  ]);
  return { sessionsDeleted: sessions.count, tokensDeleted: tokens.count, authEventsDeleted: events.count, ranAt: now.toISOString() };
}
