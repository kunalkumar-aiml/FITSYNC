import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { rowsToCsv } from "@/lib/research/ingestion/csv-writer";
import type { ChartRow } from "@/lib/engine";
export const dynamic = "force-dynamic";

// CSV preview/download of a stored version (cm). Re-importable through the CSV importer.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const params = await ctx.params;
  await requireAdmin();
  const v = await db.brandSizeChartVersion.findUnique({ where: { id: params.id } });
  if (!v) throw new ApiError(404, "Chart version not found.");
  return new Response(rowsToCsv(v.rows as unknown as ChartRow[]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `inline; filename="chart-${v.id}.csv"` } });
});
