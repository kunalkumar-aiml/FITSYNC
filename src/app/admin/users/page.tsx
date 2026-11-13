import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { UsersPanel } from "@/components/admin/users-panel";
export const metadata = { title: "Users · Admin" };
export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: { searchParams: { q?: string } }) {
  const me = await requirePageAdmin();
  const q = searchParams.q?.trim().slice(0, 120);
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerifiedAt: true, lastLoginAt: true, disabledAt: true, _count: { select: { recommendations: true, feedback: true } } },
  });
  return (
    <>
      <AdminHeader title="Users" lede="Roles and access. Promotion to administrator needs a confirmed email; you can’t change your own role; the last administrator can’t be removed. Measurements are never shown here." />
      <UsersPanel meId={me.id} q={q ?? ""} users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, disabledAt: u.disabledAt?.toISOString() ?? null }))} />
    </>
  );
}
