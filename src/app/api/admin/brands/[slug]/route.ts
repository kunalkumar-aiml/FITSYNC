import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { brandEditSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

export const PATCH = route(async (req: Request, { params }: { params: { slug: string } }) => {
  await requireAdmin();
  const input = await parseBody(req, brandEditSchema);
  if (!(await db.brand.findUnique({ where: { slug: params.slug } }))) throw new ApiError(404, "Brand not found.");
  return ok(await db.brand.update({ where: { slug: params.slug }, data: input }));
});
