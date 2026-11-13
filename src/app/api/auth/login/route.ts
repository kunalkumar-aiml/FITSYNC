import { db } from "@/lib/db";
import { ApiError, ConfigError, ok, parseBody, route } from "@/lib/api";
import { configProblems, PROBLEM_HELP } from "@/lib/readiness";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/security/password";
import { clientIp } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { startSession } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

const GENERIC = "Email or password is incorrect.";

export const POST = route(async (req: Request) => {
  const problems = configProblems();
  if (problems.length) {
    console.error("[login] refused: deployment is misconfigured:", problems.map((p) => PROBLEM_HELP[p]).join(" "));
    throw new ConfigError(problems[0], "Login refused: deployment misconfigured");
  }
  await rateLimit(`login:ip:${clientIp(req.headers)}`, 10, 60_000);
  const input = await parseBody(req, loginSchema);
  await rateLimit(`login:email:${input.email}`, 8, 15 * 60_000);
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await burnPasswordCheck(input.password); // same work as a real check: no enumeration by timing
    await logAuthEvent("LOGIN_FAILURE", { headers: req.headers });
    throw new ApiError(401, GENERIC);
  }
  const check = await verifyPassword(input.password, user.passwordHash);
  if (!check.ok) {
    await logAuthEvent("LOGIN_FAILURE", { userId: user.id, headers: req.headers });
    throw new ApiError(401, GENERIC);
  }
  // The password was right, so saying the account is disabled reveals nothing to a stranger.
  if (user.disabledAt) {
    await logAuthEvent("LOGIN_BLOCKED_DISABLED", { userId: user.id, headers: req.headers });
    throw new ApiError(403, "This account has been disabled. Contact the FITSYNC team if you think this is a mistake.");
  }
  if (check.needsRehash) {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
    await logAuthEvent("PASSWORD_REHASHED", { userId: user.id });
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user.id, req.headers); // also revokes any session cookie sent with this request (rotation)
  await logAuthEvent("LOGIN_SUCCESS", { userId: user.id, headers: req.headers });
  return ok({ id: user.id, email: user.email, name: user.name, emailVerified: !!user.emailVerifiedAt });
});
