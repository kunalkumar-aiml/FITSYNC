import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/session";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const profile = await db.userProfile.findUnique({ where: { userId: user.id } });
  return ok({ user, profile });
});

// Permanently deletes the account and everything linked to it (cascade).
export const DELETE = route(async () => {
  const user = await requireUser();
  await db.user.delete({ where: { id: user.id } });
  clearSessionCookie();
  return ok({ deleted: true });
});
