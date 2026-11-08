import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";
import { setSessionCookie } from "@/lib/session";
import { adminEmails } from "@/lib/env";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  rateLimit(`register:${clientIp(req)}`, 5, 60_000);
  const input = await parseBody(req, registerSchema);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "An account with this email already exists. Try logging in.");
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: adminEmails().includes(input.email) ? "ADMIN" : "USER",
      profile: { create: {} },
    },
    select: { id: true, email: true, name: true, role: true },
  });
  await setSessionCookie(user.id);
  return ok(user, 201);
});
