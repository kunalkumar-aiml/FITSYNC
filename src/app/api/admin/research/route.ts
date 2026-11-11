import { db } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { researchJobSchema } from "@/lib/schemas";
import { runJob } from "@/lib/research-job";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = route(async () => {
  await requireAdmin();
  const jobs = await db.researchJob.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { sources: { orderBy: { retrievedAt: "desc" } } } });
  return ok(jobs);
});

// Starts a job and runs it inline (max 5 URLs). URLs are validated against the SSRF allowlist BEFORE anything is fetched.
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  const { targets } = await parseBody(req, researchJobSchema); // SSRF/allow-list validation first; bad input never costs quota
  rateLimit(`research:${admin.id}`, 3, 10 * 60_000);
  const job = await db.researchJob.create({ data: { targets, createdById: admin.id } });
  await runJob(job.id);
  return ok(await db.researchJob.findUnique({ where: { id: job.id }, include: { sources: true } }), 201);
});
