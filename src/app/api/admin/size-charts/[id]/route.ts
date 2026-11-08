import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { verifySchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

// :id is a chart VERSION id. Verifying requires a source (URL or note) so provenance is always recorded.
export const PUT = route(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, verifySchema);
  const v = await db.brandSizeChartVersion.findUnique({ where: { id: params.id } });
  if (!v) throw new ApiError(404, "Chart version not found.");
  const sourceUrl = input.sourceUrl ?? v.sourceUrl;
  const sourceNote = input.sourceNote ?? v.sourceNote;
  if (input.status === "VERIFIED" && !sourceUrl && !sourceNote) {
    throw new ApiError(400, "Add a source URL or note before marking a chart as verified.");
  }
  const updated = await db.brandSizeChartVersion.update({
    where: { id: v.id },
    data: {
      status: input.status, sourceUrl, sourceNote,
      verifiedAt: input.status === "VERIFIED" ? new Date() : null,
      verifiedById: input.status === "VERIFIED" ? admin.id : null,
    },
  });
  return ok(updated);
});
