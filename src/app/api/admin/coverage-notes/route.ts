import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { coverageNoteSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";

/** Record that data was looked for and not found: brand-level (no productId) or product-level (productId). */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, coverageNoteSchema);
  const brand = await db.brand.findUnique({ where: { slug: input.brandSlug } });
  if (!brand) throw new ApiError(404, "Brand not found.");
  if (input.productId && !(await db.product.findFirst({ where: { id: input.productId, brandId: brand.id } }))) throw new ApiError(400, "That product does not belong to this brand.");
  const category = input.categorySlug ? await db.clothingCategory.findUnique({ where: { slug: input.categorySlug } }) : null;
  if (input.categorySlug && !category) throw new ApiError(404, "Category not found.");
  const note = await db.brandCoverageNote.create({ data: { brandId: brand.id, productId: input.productId ?? null, categoryId: category?.id ?? null, gender: input.gender ?? null, note: input.note, sourceUrl: input.sourceUrl ?? null } });
  await logAdmin(admin, input.productId ? "coverage.product_missing" : "coverage.brand_missing", "BrandCoverageNote", note.id, { brand: brand.slug, productId: input.productId ?? null, category: input.categorySlug ?? null });
  return ok(note, 201);
});
