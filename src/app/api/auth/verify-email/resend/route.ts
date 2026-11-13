import { ApiError, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendVerification } from "@/lib/verification";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  if (user.emailVerifiedAt) throw new ApiError(400, "Your email is already confirmed.");
  await rateLimit(`verify-resend:${user.id}`, 3, 15 * 60_000);
  return ok(await sendVerification(user, req));
});
