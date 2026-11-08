import { db } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const PUT = route(async (_req: Request, { params }: { params: { slug: string } }) => {
  const user = await requireUser();
  const brand = await db.brand.findUnique({ where: { slug: params.slug } });
  if (!brand) throw new ApiError(404, "Brand not found.");
  await db.savedBrand.upsert({
    where: { userId_brandId: { userId: user.id, brandId: brand.id } },
    create: { userId: user.id, brandId: brand.id }, update: {},
  });
  return ok({ saved: true });
});

export const DELETE = route(async (_req: Request, { params }: { params: { slug: string } }) => {
  const user = await requireUser();
  const brand = await db.brand.findUnique({ where: { slug: params.slug } });
  if (brand) await db.savedBrand.deleteMany({ where: { userId: user.id, brandId: brand.id } });
  return ok({ saved: false });
});
