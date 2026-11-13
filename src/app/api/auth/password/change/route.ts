import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { passwordProblem } from "@/lib/security/password-policy";
import { rateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/schemas";
import { revokeAllSessions } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** Change password with the current one. Other devices are signed out; this one stays signed in. */
export const POST = route(async (req: Request) => {
  const s = await requireSession();
  await rateLimit(`pw-change:${s.user.id}`, 5, 15 * 60_000);
  const input = await parseBody(req, changePasswordSchema);
  const row = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
  if (!(await verifyPassword(input.currentPassword, row.passwordHash)).ok) throw new ApiError(400, "Your current password is not correct.", { currentPassword: ["Your current password is not correct."] });
  const problem = passwordProblem(input.newPassword, { email: row.email, name: row.name });
  if (problem) throw new ApiError(400, problem, { newPassword: [problem] });
  await db.user.update({ where: { id: row.id }, data: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() } });
  const { count } = await revokeAllSessions(row.id, s.sessionId);
  await logAuthEvent("PASSWORD_CHANGED", { userId: row.id, headers: req.headers });
  return ok({ changed: true, otherSessionsSignedOut: count });
});
