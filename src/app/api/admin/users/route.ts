import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { userSearchSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

const PAGE = 50;

/** Account list for administrators. Deliberately excludes body measurements and recommendation contents. */
export const GET = route(async (req: Request) => {
  await requireAdmin();
  const u = new URL(req.url);
  const { q, page } = userSearchSchema.parse({ q: u.searchParams.get("q") ?? undefined, page: u.searchParams.get("page") ?? undefined });
  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerifiedAt: true, lastLoginAt: true, disabledAt: true, _count: { select: { recommendations: true, feedback: true } } },
    }),
  ]);
  return ok({ total, page, pageSize: PAGE, users });
});
