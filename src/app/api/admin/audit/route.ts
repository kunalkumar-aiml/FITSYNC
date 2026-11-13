import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  await requireAdmin();
  const take = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("take") ?? 100) || 100));
  const [admin, auth] = await Promise.all([
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take }),
    db.authEvent.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, type: true, userId: true, createdAt: true } }),
  ]);
  return ok({ admin, auth });
});
