import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { CompareClient } from "@/components/compare-client";
import { CATEGORY_CONFIGS } from "@/lib/engine";
export const metadata = { title: "Compare brands" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requirePageUser();
  const profile = await db.userProfile.findUnique({ where: { userId: user.id } });
  return <CompareClient categories={CATEGORY_CONFIGS.map((c) => ({ slug: c.slug, name: c.name }))} defaultFit={profile?.fitPreference ?? "REGULAR"} defaultGender={(profile?.fitCategory as "MEN" | "WOMEN" | "UNISEX" | null) ?? null} />;
}
