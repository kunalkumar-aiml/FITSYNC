import type { AuthTokenType } from "@prisma/client";
import { db } from "./db";
import { randomToken, sha256 } from "./security/crypto";

export const TOKEN_TTL: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/** Issue a single-use token. Earlier unused tokens of the same type for this user stop working. Returns the raw token (sent by email only). */
export async function issueToken(userId: string, email: string, type: AuthTokenType) {
  const token = randomToken();
  await db.$transaction([
    db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    db.authToken.create({ data: { userId, email, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) } }),
  ]);
  return token;
}

/**
 * Consume a token atomically: the conditional update succeeds for exactly one request, so a token can never be used twice
 * even under concurrent requests. Returns the user, or null for unknown / expired / used / mismatched tokens.
 */
export async function consumeToken(raw: string, type: AuthTokenType) {
  if (!raw || raw.length > 200) return null;
  const tokenHash = sha256(raw);
  const { count } = await db.authToken.updateMany({ where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (count !== 1) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!t || t.user.email !== t.email) return null; // the address changed after the token was issued
  return t.user;
}
