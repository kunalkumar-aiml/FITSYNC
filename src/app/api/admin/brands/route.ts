import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { brandSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const POST = route(async (req: Request) => {
  await requireAdmin();
  const input = await parseBody(req, brandSchema);
  const slug = slugify(input.name);
  if (await db.brand.findUnique({ where: { slug } })) throw new ApiError(409, "A brand with this name already exists.");
  return ok(await db.brand.create({ data: { slug, name: input.name, region: input.region } }), 201);
});
