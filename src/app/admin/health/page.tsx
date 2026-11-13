import { db } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { emailProvider } from "@/lib/email";
import { rateLimitBackend } from "@/lib/rate-limit";
import { discoveryProvider } from "@/lib/research/discovery";
export const metadata = { title: "System health · Admin" };
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean | null; detail: string };

export default async function Health() {
  await requirePageAdmin();
  const t0 = Date.now();
  let dbOk = true;
  try { await db.$queryRaw`SELECT 1`; } catch { dbOk = false; }
  const latency = Date.now() - t0;
  let migrations: { migration_name: string; finished_at: Date | null }[] = [];
  try { migrations = await db.$queryRaw`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5`; } catch { /* table absent when migrations were applied by hand */ }
  const [failedJobs, runningJobs, activeSessions] = await Promise.all([
    db.researchJob.count({ where: { state: "FAILED" } }),
    db.researchJob.count({ where: { state: "RUNNING", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } } }),
    db.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  const prod = process.env.NODE_ENV === "production";
  const email = emailProvider();
  const checks: Check[] = [
    { name: "Database", ok: dbOk, detail: dbOk ? `Reachable, ${latency} ms` : "Not reachable" },
    { name: "Migrations", ok: migrations.length ? migrations.every((m) => m.finished_at) : null, detail: migrations.length ? `Latest: ${migrations[0].migration_name}` : "No migration table found (applied outside Prisma?)" },
    { name: "Session secret (AUTH_SECRET)", ok: (process.env.AUTH_SECRET?.length ?? 0) >= 32, detail: (process.env.AUTH_SECRET?.length ?? 0) >= 32 ? "Set" : "Missing or shorter than 32 characters" },
    { name: "Email delivery", ok: email === "resend" ? true : prod ? false : null, detail: email === "resend" ? "Resend configured" : email === "console" ? "Development console only (emails are not delivered)" : email === "outbox" ? "Test outbox (emails are not delivered)" : "Not configured: verification and reset emails cannot be sent" },
    { name: "Rate limiting", ok: rateLimitBackend() === "upstash" ? true : prod ? false : null, detail: rateLimitBackend() === "upstash" ? "Shared Upstash Redis store" : "In-memory, per instance" },
    { name: "Public URL (APP_URL)", ok: process.env.APP_URL ? true : prod ? false : null, detail: process.env.APP_URL ?? "Not set: email links use the request’s origin" },
    { name: "Retention job (CRON_SECRET)", ok: (process.env.CRON_SECRET?.length ?? 0) >= 16 ? true : prod ? false : null, detail: process.env.CRON_SECRET ? "Configured" : "Not set: /api/cron/cleanup refuses to run" },
    { name: "Source discovery", ok: discoveryProvider() ? true : null, detail: discoveryProvider() ? `Search API: ${discoveryProvider()}` : "Not configured (optional)" },
    { name: "Research jobs", ok: failedJobs === 0 && runningJobs === 0, detail: `${failedJobs} failed, ${runningJobs} stuck for over 10 minutes` },
    { name: "Active sessions", ok: null, detail: String(activeSessions) },
  ];
  return (
    <>
      <AdminHeader title="System health" lede="Configuration and runtime checks. Secret values are never displayed." />
      <ul className="divide-y divide-line border-y border-line">
        {checks.map((c) => (
          <li key={c.name} className="grid sm:grid-cols-[16rem_6rem_1fr] gap-2 py-3.5 text-sm">
            <span className="font-medium">{c.name}</span>
            <span className={c.ok === true ? "text-good" : c.ok === false ? "text-bad" : "text-muted"}>{c.ok === true ? "OK" : c.ok === false ? "Action needed" : "Info"}</span>
            <span className="text-muted">{c.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted">Runtime: Node {process.version}, {prod ? "production" : "development"} mode{process.env.VERCEL ? ", on Vercel" : ""}.</p>
    </>
  );
}
