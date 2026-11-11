import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { editVersionSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

// Corrections never overwrite history: they create a NEW unverified version (v+1) and log an EDITED decision.
// Resolving an ambiguous measurement is a human statement of what it is, recorded in measurementSemantics.
export const POST = route(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, editVersionSchema);
  const v = await db.brandSizeChartVersion.findUnique({ where: { id: params.id } });
  if (!v) throw new ApiError(404, "Chart version not found.");
  const semantics = { ...((v.measurementSemantics as Record<string, string>) ?? {}), ...(input.resolveSemantics ?? {}) };
  const amb = ((v.ambiguousDimensions as string[]) ?? []).filter((d) => !(input.resolveSemantics && d in input.resolveSemantics));
  const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: v.chartId }, orderBy: { version: "desc" } });
  const created = await db.brandSizeChartVersion.create({
    data: {
      chartId: v.chartId, version: (last?.version ?? 0) + 1, rows: (input.rows ?? v.rows) as object, measurementType: input.measurementType ?? v.measurementType,
      sourceType: v.sourceType, originalUnit: "CM", retrievedAt: v.retrievedAt, sourceDomain: v.sourceDomain, extractionMethod: "ADMIN_EDIT",
      sourceUrl: v.sourceUrl, sourceNote: `${v.sourceNote ?? ""}\nEdit: ${input.note}`.trim(), status: "UNVERIFIED",
      measurementSemantics: semantics as object, ambiguousDimensions: amb as object,
    },
  });
  await db.dataVerification.create({ data: { chartVersionId: created.id, action: "EDITED", adminId: admin.id, note: input.note } });
  return ok(created, 201);
});
