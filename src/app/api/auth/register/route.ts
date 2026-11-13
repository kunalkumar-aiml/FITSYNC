import { db } from "@/lib/db";
import { ApiError, ConfigError, errorKind, ok, parseBody, route } from "@/lib/api";
import { hashPassword } from "@/lib/security/password";
import { clientIp } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";
import { prepareSession, revokePresentedSession, setSessionCookie } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
import { sendVerification } from "@/lib/verification";
import { configProblems, PROBLEM_HELP } from "@/lib/readiness";
export const dynamic = "force-dynamic";

const EXISTS = "An account with this email already exists. Try logging in, or reset your password.";

/**
 * Public registration ALWAYS creates a USER. There is no way to become an administrator from here:
 * see scripts/admin-bootstrap.ts and Admin → Users (promotion requires an existing admin and a verified email).
 *
 * The account, its empty profile and its first session are written in ONE nested create, so a failure can never
 * leave a half-created account behind (which used to turn a retry into "an account with this email already exists").
 * Everything that can fail for configuration reasons runs before that write.
 */
export const POST = route(async (req: Request) => {
  const problems = configProblems();
  if (problems.length) {
    console.error("[register] refused: deployment is misconfigured:", problems.map((p) => PROBLEM_HELP[p]).join(" "));
    throw new ConfigError(problems[0], "Registration refused: deployment misconfigured");
  }
  const ip = clientIp(req.headers);
  await rateLimit(`register:ip:${ip}`, 5, 60_000);
  await rateLimit(`register:ip-hour:${ip}`, 30, 60 * 60_000);
  const input = await parseBody(req, registerSchema);
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new ApiError(409, EXISTS);

  const passwordHash = await hashPassword(input.password);
  const session = prepareSession(req.headers);
  const now = new Date();
  let user;
  try {
    user = await db.user.create({
      data: {
        email: input.email, name: input.name, passwordHash, passwordChangedAt: now, lastLoginAt: now, role: "USER",
        profile: { create: {} },
        sessions: { create: session.data },
      },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch (e) {
    // Two sign-ups with the same address at the same moment: the unique index decides, the loser gets the normal message.
    if (errorKind(e) === "conflict") throw new ApiError(409, EXISTS);
    throw e;
  }
  await revokePresentedSession().catch(() => {});
  setSessionCookie(session.token);
  await logAuthEvent("REGISTER", { userId: user.id, headers: req.headers });

  // The account exists and the user is signed in. A failure to send the confirmation email must not turn that into an error.
  let verification: Awaited<ReturnType<typeof sendVerification>>;
  try {
    verification = await sendVerification(user, req);
  } catch (e) {
    console.error("[register] could not issue the verification email:", (e as Error).message);
    verification = { delivery: "unavailable", message: "Your account is ready, but we couldn’t send the confirmation email just now. You can resend it from your dashboard." };
  }
  return ok({ user, verification }, 201);
});
