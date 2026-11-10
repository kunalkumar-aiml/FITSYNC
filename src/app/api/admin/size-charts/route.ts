import { ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { chartVersionSchema } from "@/lib/schemas";
import { createChartVersion } from "@/lib/chart-admin";
export const dynamic = "force-dynamic";

// Creates a NEW unverified version (rows in cm). Verify it with PUT /size-charts/:versionId.
export const POST = route(async (req: Request) => {
  await requireAdmin();
  const input = await parseBody(req, chartVersionSchema);
  return ok(await createChartVersion(input), 201);
});
