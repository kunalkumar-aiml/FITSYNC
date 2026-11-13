import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { clearSessionCookies, revokeAllSessions } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** Signs the account out on every device, including this one. */
export const POST = route(async (req: Request) => {
  const s = await requireSession();
  const { count } = await revokeAllSessions(s.user.id);
  clearSessionCookies();
  await logAuthEvent("LOGOUT_ALL", { userId: s.user.id, headers: req.headers });
  return ok({ revoked: count });
});
