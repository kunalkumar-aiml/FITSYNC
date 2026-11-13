import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { hashPassword } from "@/lib/security/password";
import { clientIp } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";
import { startSession } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
import { sendVerification } from "@/lib/verification";
export const dynamic = "force-dynamic";

/**
 * Public registration ALWAYS creates a USER. There is no way to become an administrator from here:
 * see scripts/admin-bootstrap.ts and Admin → Users (promotion requires an existing admin and a verified email).
 */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req.headers);
  await rateLimit(`register:ip:${ip}`, 5, 60_000);
  await rateLimit(`register:ip-hour:${ip}`, 30, 60 * 60_000);
  const input = await parseBody(req, registerSchema);
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new ApiError(409, "An account with this email already exists. Try logging in, or reset your password.");
  const now = new Date();
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password), passwordChangedAt: now, lastLoginAt: now, role: "USER", profile: { create: {} } },
    select: { id: true, email: true, name: true, role: true },
  });
  await startSession(user.id, req.headers);
  await logAuthEvent("REGISTER", { userId: user.id, headers: req.headers });
  const verification = await sendVerification(user, req);
  return ok({ user, verification }, 201);
});
