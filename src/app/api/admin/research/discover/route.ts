import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { discoverySchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { logAdmin } from "@/lib/audit";
import { discoverSources } from "@/lib/research/discovery";
export const dynamic = "force-dynamic";

/** Propose candidate source URLs via a permitted search API. Nothing is fetched or stored here. */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  await rateLimit(`discover:${admin.id}`, 10, 10 * 60_000);
  const input = await parseBody(req, discoverySchema);
  const brand = await db.brand.findUnique({ where: { slug: input.brand } });
  if (!brand) throw new ApiError(404, "Brand not found.");
  const result = await discoverSources({ brandName: brand.name, brandSlug: brand.slug, category: input.category, gender: input.gender, productQuery: input.productQuery });
  if (result.configured) await logAdmin(admin, "research.discover", "Brand", brand.id, { queries: result.queries, candidates: result.candidates.length });
  return ok(result);
});
