import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { marketplaceSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
export const dynamic = "force-dynamic";

// Marketplaces are sources of product listings, never brands. They own no charts.
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, marketplaceSchema);
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (await db.marketplace.findFirst({ where: { OR: [{ slug }, { domain: input.domain }] } })) throw new ApiError(409, "That marketplace already exists.");
  const m = await db.marketplace.create({ data: { slug, name: input.name, domain: input.domain } });
  await logAdmin(admin, "marketplace.create", "Marketplace", m.id, { name: m.name, domain: m.domain });
  return ok(m, 201);
});
