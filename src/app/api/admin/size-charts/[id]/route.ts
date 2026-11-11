import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { decisionSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

// :id is a chart VERSION id. Every decision is stored in DataVerification (audit trail).
// APPROVE needs a recorded source and refuses while any measurement is still ambiguous.
export const PUT = route(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, decisionSchema);
  const v = await db.brandSizeChartVersion.findUnique({ where: { id: params.id } });
  if (!v) throw new ApiError(404, "Chart version not found.");
  const sourceUrl = input.sourceUrl ?? v.sourceUrl;
  if (input.action === "APPROVE") {
    if (!sourceUrl && !v.sourceNote) throw new ApiError(400, "Add a source URL or note before approving.");
    const amb = Array.isArray(v.ambiguousDimensions) ? v.ambiguousDimensions : [];
    if (amb.length) throw new ApiError(400, `Resolve the ambiguous measurement(s) first: ${amb.join(", ")}. Say whether each is a body or garment measurement.`);
  }
  const status = input.action === "APPROVE" ? "VERIFIED" : input.action === "FLAG" ? "UNVERIFIED" : "DEPRECATED";
  const [updated] = await db.$transaction([
    db.brandSizeChartVersion.update({ where: { id: v.id }, data: { status, sourceUrl, verifiedAt: status === "VERIFIED" ? new Date() : null, verifiedById: status === "VERIFIED" ? admin.id : null } }),
    db.dataVerification.create({ data: { chartVersionId: v.id, action: input.action === "APPROVE" ? "APPROVED" : input.action === "REJECT" ? "REJECTED" : input.action === "FLAG" ? "FLAGGED" : "DEPRECATED", adminId: admin.id, note: input.note } }),
  ]);
  return ok(updated);
});
