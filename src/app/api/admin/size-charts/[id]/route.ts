import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { decisionSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
import { DIMENSIONS, parseSemantics, semanticFor, type MeasurementType } from "@/lib/engine";
export const dynamic = "force-dynamic";

const STATUS = { APPROVE: "VERIFIED", REJECT: "INVALID", FLAG: "NEEDS_HUMAN_VERIFICATION", DEPRECATE: "DEPRECATED" } as const;
const ACTION = { APPROVE: "APPROVED", REJECT: "REJECTED", FLAG: "FLAGGED", DEPRECATE: "DEPRECATED" } as const;

/**
 * :id is a chart VERSION id. Only a person can verify data: nothing in the pipeline sets VERIFIED.
 * APPROVE needs a recorded source and refuses while any body-comparable measurement is still ambiguous or a flat width.
 * Every decision is stored in DataVerification and in the admin audit log.
 */
export const PUT = route(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, decisionSchema);
  const v = await db.brandSizeChartVersion.findUnique({ where: { id: params.id } });
  if (!v) throw new ApiError(404, "Chart version not found.");
  const sourceUrl = input.sourceUrl ?? v.sourceUrl;
  if (input.action === "APPROVE") {
    if (!sourceUrl && !v.sourceNote) throw new ApiError(400, "Add a source URL or note before approving.");
    const chart = { semantics: parseSemantics(v.measurementSemantics), ambiguousDimensions: (Array.isArray(v.ambiguousDimensions) ? v.ambiguousDimensions : []) as never[], measurementType: v.measurementType as MeasurementType };
    const rows = (v.rows ?? []) as Record<string, unknown>[];
    const present = DIMENSIONS.filter((d) => rows.some((r) => r[d] !== undefined));
    const open = present.filter((d) => !["BODY", "GARMENT"].includes(semanticFor(chart, d)));
    if (open.length) throw new ApiError(400, `Resolve the meaning of ${open.join(", ")} first: say whether each is a body or garment measurement (or convert a flat width).`);
  }
  const status = STATUS[input.action];
  const [updated] = await db.$transaction([
    db.brandSizeChartVersion.update({ where: { id: v.id }, data: { status, sourceUrl, verifiedAt: status === "VERIFIED" ? new Date() : null, verifiedById: status === "VERIFIED" ? admin.id : null } }),
    db.dataVerification.create({ data: { chartVersionId: v.id, action: ACTION[input.action], adminId: admin.id, note: input.note } }),
  ]);
  await logAdmin(admin, `chart.${input.action.toLowerCase()}`, "BrandSizeChartVersion", v.id, { from: v.status, to: status, note: input.note ?? null });
  return ok(updated);
});
