import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { accountSchema, deleteAccountSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/rate-limit";
import { clearSessionCookies } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const profile = await db.userProfile.findUnique({ where: { userId: user.id } });
  return ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: !!user.emailVerifiedAt }, profile });
});

/** Account information and preferences. Email changes are not offered yet (they would need re-verification). */
export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, accountSchema);
  if (input.name !== undefined) await db.user.update({ where: { id: user.id }, data: { name: input.name || null } });
  const prefs = { ...(input.preferredUnit ? { preferredUnit: input.preferredUnit } : {}), ...(input.fitPreference ? { fitPreference: input.fitPreference } : {}), ...(input.fitCategory !== undefined ? { fitCategory: input.fitCategory } : {}) };
  const profile = await db.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...prefs }, update: prefs });
  return ok({ profile });
});

/**
 * Permanently deletes the account and everything linked to it (sessions, tokens, measurements, recommendations,
 * feedback, saved brands, security events: all cascade). Requires the password again.
 */
export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`delete-account:${user.id}`, 5, 15 * 60_000);
  const { password } = await parseBody(req, deleteAccountSchema);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(password, row.passwordHash)).ok) throw new ApiError(400, "That password is not correct.", { password: ["That password is not correct."] });
  if (row.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN", disabledAt: null } })) <= 1) {
    throw new ApiError(409, "You are the only administrator. Make another verified account an admin before deleting this one.");
  }
  await db.user.delete({ where: { id: user.id } });
  clearSessionCookies();
  await logAuthEvent("ACCOUNT_DELETED", { headers: req.headers }); // not linked to the deleted user
  return ok({ deleted: true });
});
