import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { brandEditSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const params = await ctx.params;
  const admin = await requireAdmin();
  const input = await parseBody(req, brandEditSchema);
  const before = await db.brand.findUnique({ where: { slug: params.slug } });
  if (!before) throw new ApiError(404, "Brand not found.");
  const after = await db.brand.update({ where: { slug: params.slug }, data: input });
  await logAdmin(admin, "brand.update", "Brand", after.id, { slug: after.slug, before: { name: before.name, region: before.region, active: before.active }, after: input });
  return ok(after);
});
