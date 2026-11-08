import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { checkPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { setSessionCookie } from "@/lib/session";
import { adminEmails } from "@/lib/env";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  const input = await parseBody(req, loginSchema);
  rateLimit(`login-email:${input.email}`, 8, 5 * 60_000);
  const user = await db.user.findUnique({ where: { email: input.email } });
  // Same message for unknown email and wrong password, to avoid account enumeration.
  if (!user || !(await checkPassword(input.password, user.passwordHash))) {
    throw new ApiError(401, "Email or password is incorrect.");
  }
  if (user.role !== "ADMIN" && adminEmails().includes(user.email)) {
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }
  await setSessionCookie(user.id);
  return ok({ id: user.id, email: user.email, name: user.name });
});
