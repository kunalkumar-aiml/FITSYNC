import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { brandSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, brandSchema);
  const slug = slugify(input.name);
  if (await db.brand.findUnique({ where: { slug } })) throw new ApiError(409, "A brand with this name already exists.");
  const b = await db.brand.create({ data: { slug, name: input.name, region: input.region } });
  await logAdmin(admin, "brand.create", "Brand", b.id, { slug, name: b.name, region: b.region });
  return ok(b, 201);
});
