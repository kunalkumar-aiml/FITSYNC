import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

// Lets a user download everything we hold about them (data-access right under privacy laws).
export const GET = route(async () => {
  const user = await requireUser();
  const data = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true, name: true, createdAt: true, profile: true, measurement: true,
      recommendations: { select: { id: true, createdAt: true, fitPreference: true, recommendedSize: true, confidence: true, result: true } },
      feedback: true, savedBrands: true,
    },
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="fitsync-data.json"' },
  });
});
