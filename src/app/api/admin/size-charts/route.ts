import { ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { chartVersionSchema } from "@/lib/schemas";
import { createChartVersion } from "@/lib/chart-admin";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";

// Creates a NEW unverified version (rows in cm). Verify it with PUT /size-charts/:versionId.
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, chartVersionSchema);
  const v = await createChartVersion(input);
  await logAdmin(admin, "chart.create", "BrandSizeChartVersion", v.id, { brand: input.brandSlug, category: input.categorySlug, gender: input.gender, region: input.region, rows: input.rows.length, duplicate: v.duplicate ?? false });
  return ok(v, 201);
});
