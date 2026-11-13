import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { issueToken } from "@/lib/auth-tokens";
import { emailConfigured, resetEmail, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { clientIp } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { forgotSchema } from "@/lib/schemas";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

/**
 * Always answers the same way whether or not the address has an account (no enumeration).
 * The only different answer is when email delivery is not configured at all, which is true for every address.
 */
export const POST = route(async (req: Request) => {
  await rateLimit(`forgot:ip:${clientIp(req.headers)}`, 5, 15 * 60_000);
  const { email } = await parseBody(req, forgotSchema);
  await rateLimit(`forgot:email:${email}`, 3, 60 * 60_000);
  if (!emailConfigured()) throw new ApiError(503, "Password reset by email is not available right now because email delivery is not configured. Contact the FITSYNC team.", { code: "EMAIL_UNAVAILABLE" });
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, disabledAt: true } });
  if (user && !user.disabledAt) {
    const token = await issueToken(user.id, user.email, "PASSWORD_RESET");
    const res = await sendEmail(resetEmail(user.email, `${appUrl(new URL(req.url).origin)}/reset-password?token=${encodeURIComponent(token)}`));
    if (res.status === "unavailable") console.error("[auth] reset email not delivered:", res.reason);
    await logAuthEvent("PASSWORD_RESET_REQUESTED", { userId: user.id, headers: req.headers });
  }
  return ok({ message: "If an account exists for that address, we’ve sent a link to reset the password. It expires in 1 hour." });
});
