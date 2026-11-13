import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { isSessionUsable } from "@/lib/session";
import { deviceLabel } from "@/lib/security/request-meta";
export const dynamic = "force-dynamic";

/** The signed-in user's own active sessions. */
export const GET = route(async () => {
  const s = await requireSession();
  const rows = await db.session.findMany({ where: { userId: s.user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 50 });
  return ok(rows.filter((r) => isSessionUsable(r)).map((r) => ({
    id: r.id, device: deviceLabel(r.userAgent), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, current: r.id === s.sessionId,
  })));
});
