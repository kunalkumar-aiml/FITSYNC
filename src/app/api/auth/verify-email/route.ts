import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { consumeToken } from "@/lib/auth-tokens";
import { clientIp } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { tokenSchema } from "@/lib/schemas";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  await rateLimit(`verify:ip:${clientIp(req.headers)}`, 20, 15 * 60_000);
  const { token } = await parseBody(req, tokenSchema);
  const user = await consumeToken(token, "EMAIL_VERIFICATION");
  if (!user) throw new ApiError(400, "This link is invalid, already used or expired. Request a new one from your dashboard.", { code: "TOKEN_INVALID" });
  if (!user.emailVerifiedAt) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await logAuthEvent("EMAIL_VERIFIED", { userId: user.id, headers: req.headers });
  return ok({ verified: true });
});
