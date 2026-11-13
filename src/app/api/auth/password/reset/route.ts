import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { consumeToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/security/password";
import { passwordProblem } from "@/lib/security/password-policy";
import { clientIp } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { resetSchema } from "@/lib/schemas";
import { clearSessionCookies, revokeAllSessions } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** Sets a new password, then signs the account out everywhere. The user logs in again with the new password. */
export const POST = route(async (req: Request) => {
  await rateLimit(`reset:ip:${clientIp(req.headers)}`, 10, 15 * 60_000);
  const { token, password } = await parseBody(req, resetSchema);
  const user = await consumeToken(token, "PASSWORD_RESET");
  if (!user) throw new ApiError(400, "This reset link is invalid, already used or expired. Request a new one.", { code: "TOKEN_INVALID" });
  const problem = passwordProblem(password, { email: user.email, name: user.name });
  if (problem) throw new ApiError(400, problem, { password: [problem] });
  await db.user.update({
    where: { id: user.id },
    // Completing a reset proves control of the inbox, so the address also counts as verified.
    data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  await db.authToken.updateMany({ where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
  await revokeAllSessions(user.id);
  clearSessionCookies();
  await logAuthEvent("PASSWORD_RESET_COMPLETED", { userId: user.id, headers: req.headers });
  return ok({ reset: true });
});
