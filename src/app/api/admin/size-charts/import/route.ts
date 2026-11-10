import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { chartImportSchema } from "@/lib/schemas";
import { createChartVersion } from "@/lib/chart-admin";
import { parseChartCsv } from "@/lib/csv";
export const dynamic = "force-dynamic";

// CSV import. The server parses, validates and converts to cm. With dryRun=true nothing is saved and the
// parsed rows come back for preview. A saved import always becomes a new UNVERIFIED version.
export const POST = route(async (req: Request) => {
  await requireAdmin();
  const { csv, dryRun, ...meta } = await parseBody(req, chartImportSchema);
  const parsed = parseChartCsv(csv, meta.originalUnit);
  if (parsed.errors.length) throw new ApiError(400, `CSV has ${parsed.errors.length} problem(s). Nothing was saved.`, { errors: parsed.errors });
  if (dryRun) return ok({ dryRun: true, rows: parsed.rows, dimensions: parsed.dimensions });
  const version = await createChartVersion({ ...meta, rows: parsed.rows });
  return ok({ dryRun: false, version, rows: parsed.rows }, 201);
});
