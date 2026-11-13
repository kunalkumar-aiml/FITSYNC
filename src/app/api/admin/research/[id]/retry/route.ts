import { db } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { runJob } from "@/lib/research-job";
import type { Target } from "@/lib/research/types";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Re-runs only the targets that did not produce usable data.
export const POST = route(async (_req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  await rateLimit(`research:${admin.id}`, 3, 10 * 60_000);
  const job = await db.researchJob.findUnique({ where: { id: params.id }, include: { sources: true } });
  if (!job) throw new ApiError(404, "Job not found.");
  const good = new Set(job.sources.filter((s) => ["SUCCESS", "PARTIAL_SUCCESS", "NEEDS_HUMAN_VERIFICATION"].includes(s.status)).map((s) => s.url));
  const redo = (job.targets as unknown as Target[]).filter((t) => !good.has(t.url));
  if (!redo.length) throw new ApiError(400, "Nothing to retry: every target already produced data.");
  await logAdmin(admin, "research.job.retry", "ResearchJob", job.id, { urls: redo.map((t) => t.url) });
  await runJob(job.id, redo);
  return ok(await db.researchJob.findUnique({ where: { id: job.id }, include: { sources: true } }));
});
