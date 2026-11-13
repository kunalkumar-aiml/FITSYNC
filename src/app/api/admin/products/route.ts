import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";

// A product always keeps its real brand. A marketplace listing is just one place the product is sold.
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, productSchema);
  const [brand, category, mk] = await Promise.all([
    db.brand.findUnique({ where: { slug: input.brandSlug } }), db.clothingCategory.findUnique({ where: { slug: input.categorySlug } }),
    input.marketplaceSlug ? db.marketplace.findUnique({ where: { slug: input.marketplaceSlug } }) : null,
  ]);
  if (!brand) throw new ApiError(404, "Brand not found.");
  if (!category) throw new ApiError(404, "Category not found.");
  if (input.marketplaceSlug && !mk) throw new ApiError(404, "Marketplace not found.");
  if (input.marketplaceSlug && !input.listingUrl) throw new ApiError(400, "A marketplace listing needs its product URL.");
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
  const product = await db.product.upsert({
    where: { brandId_slug: { brandId: brand.id, slug } },
    create: { brandId: brand.id, slug, name: input.name, categoryId: category.id, gender: input.gender, fitCut: input.fitCutStated ? input.fitCut : "UNKNOWN", fitCutStated: input.fitCutStated }, update: {},
  });
  if (input.listingUrl) await db.productListing.upsert({ where: { url: input.listingUrl }, create: { productId: product.id, marketplaceId: mk?.id ?? null, url: input.listingUrl }, update: {} });
  await logAdmin(admin, "product.create", "Product", product.id, { brand: brand.slug, name: product.name, listingUrl: input.listingUrl ?? null });
  return ok(product, 201);
});
