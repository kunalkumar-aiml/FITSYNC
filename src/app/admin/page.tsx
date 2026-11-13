import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader, Stat } from "@/components/admin/admin-header";
import { emailProvider } from "@/lib/email";
import { rateLimitBackend } from "@/lib/rate-limit";
import { Notice } from "@/components/ui";
export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function Overview() {
  await requirePageAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [users, admins, withM, recs, fb, review, unverified, failedJobs, brands, failures, audit] = await Promise.all([
    db.user.count(), db.user.count({ where: { role: "ADMIN" } }), db.bodyMeasurement.count(), db.recommendation.count(), db.userFitFeedback.count(),
    db.brandSizeChartVersion.count({ where: { status: "NEEDS_HUMAN_VERIFICATION" } }),
    db.brandSizeChartVersion.count({ where: { status: "UNVERIFIED", chart: { brand: { isDemo: false } } } }),
    db.researchJob.count({ where: { state: "FAILED" } }),
    db.brand.count({ where: { active: true, isDemo: false } }),
    db.authEvent.count({ where: { type: "LOGIN_FAILURE", createdAt: { gte: since } } }),
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const warnings = [
    emailProvider() === "none" && "Email delivery is not configured: confirmation and password-reset emails cannot be sent.",
    process.env.NODE_ENV === "production" && rateLimitBackend() === "memory" && "Rate limits use per-instance memory. Configure Upstash Redis for limits that hold across instances.",
  ].filter(Boolean) as string[];
  return (
    <>
      <AdminHeader title="Overview" lede="The state of FITSYNC’s accounts and data. Counts only; no personal measurements are shown in admin." />
      {warnings.length > 0 && <div className="space-y-2 mb-8">{warnings.map((w) => <Notice key={w} tone="warn">{w} <Link href="/admin/health" className="link">System health</Link></Notice>)}</div>}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
        <Stat label="Accounts" value={users} note={`${admins} administrator${admins === 1 ? "" : "s"}`} />
        <Stat label="With measurements" value={withM} />
        <Stat label="Saved recommendations" value={recs} />
        <Stat label="Fit reports" value={fb} />
        <Stat label="Brands tracked" value={brands} />
        <Stat label="Charts awaiting review" value={review} />
        <Stat label="Unverified charts" value={unverified} />
        <Stat label="Failed logins, 7 days" value={failures} note={failedJobs ? `${failedJobs} failed research job(s)` : undefined} />
      </dl>
      <section className="mt-12">
        <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">Recent admin activity</h2><Link href="/admin/audit" className="text-sm link">Full log</Link></div>
        {audit.length === 0 ? <p className="mt-3 text-sm text-muted">No administrative changes recorded yet.</p> : (
          <table className="table-x mt-3"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Target</th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-muted">{a.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td><td>{a.actorEmail}</td><td className="font-medium">{a.action}</td><td className="text-muted">{a.targetType}</td></tr>)}</tbody></table>
        )}
      </section>
    </>
  );
}
