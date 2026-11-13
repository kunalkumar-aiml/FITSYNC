import { db } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { clearSessionCookies } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** Revoke one of YOUR sessions. Another user's session id is answered with 404, exactly like a missing one (no IDOR). */
export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const params = await ctx.params;
  const s = await requireSession();
  const { count } = await db.session.updateMany({ where: { id: params.id, userId: s.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count !== 1) throw new ApiError(404, "Session not found.");
  if (params.id === s.sessionId) await clearSessionCookies();
  await logAuthEvent("SESSION_REVOKED", { userId: s.user.id, headers: req.headers });
  return ok({ revoked: true, current: params.id === s.sessionId });
});
