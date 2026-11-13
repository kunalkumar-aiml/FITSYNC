import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
export const metadata = { title: "Security audit log · Admin" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default async function Audit() {
  await requirePageAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [admin, events, counts] = await Promise.all([
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 150 }),
    db.authEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, type: true, userId: true, ipHash: true, createdAt: true } }),
    db.authEvent.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: true }),
  ]);
  return (
    <>
      <AdminHeader title="Security audit log" lede="Administrative changes and sign-in events. Events never contain passwords, tokens, measurements or raw IP addresses (only a keyed hash)." />
      <section>
        <h2 className="display-sm">Sign-in events, last 7 days</h2>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">{counts.sort((a, b) => b._count - a._count).map((c) => <div key={c.type} className="border-t border-line pt-2"><dt className="text-xs text-muted">{c.type.replaceAll("_", " ").toLowerCase()}</dt><dd className="font-display text-xl num">{c._count}</dd></div>)}</dl>
        {counts.length === 0 && <p className="mt-3 text-sm text-muted">No events in the last 7 days.</p>}
      </section>
      <section className="mt-12">
        <h2 className="display-sm">Administrative changes</h2>
        <div className="mt-4 overflow-x-auto"><table className="table-x min-w-[44rem]">
          <thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{admin.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-muted">{fmt(a.createdAt)}</td><td>{a.actorEmail}</td><td className="font-medium">{a.action}</td><td className="text-xs">{a.targetType}<span className="block text-muted">{a.targetId?.slice(-8)}</span></td><td className="text-xs text-muted max-w-md break-words">{JSON.stringify(a.details)}</td></tr>)}</tbody>
        </table>{admin.length === 0 && <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>}</div>
      </section>
      <section className="mt-12">
        <h2 className="display-sm">Recent sign-in events</h2>
        <div className="mt-4 overflow-x-auto"><table className="table-x">
          <thead><tr><th>When</th><th>Event</th><th>Account</th><th>Network (hash)</th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.id}><td className="whitespace-nowrap text-muted">{fmt(e.createdAt)}</td><td>{e.type.replaceAll("_", " ").toLowerCase()}</td><td className="text-xs text-muted">{e.userId ? `…${e.userId.slice(-8)}` : "unknown account"}</td><td className="text-xs text-muted font-mono">{e.ipHash?.slice(0, 10) ?? "–"}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
