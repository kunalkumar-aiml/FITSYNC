import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { deviceLabel } from "@/lib/security/request-meta";
export const dynamic = "force-dynamic";

/** Everything FITSYNC holds about the signed-in user, as JSON. Password hashes and token hashes are never included. */
export const GET = route(async () => {
  const user = await requireUser();
  await rateLimit(`export:${user.id}`, 10, 60 * 60_000);
  const data = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      email: true, name: true, role: true, createdAt: true, emailVerifiedAt: true, passwordChangedAt: true, lastLoginAt: true,
      profile: { select: { fitCategory: true, preferredUnit: true, fitPreference: true, updatedAt: true } },
      measurement: { select: { heightCm: true, weightKg: true, chestCm: true, waistCm: true, hipsCm: true, shoulderCm: true, armLengthCm: true, inseamCm: true, neckCm: true, thighCm: true, updatedAt: true } },
      recommendations: { select: { id: true, createdAt: true, fitPreference: true, recommendedSize: true, confidence: true, insufficientData: true, result: true, inputSnapshot: true, chartVersion: { select: { version: true, chart: { select: { brand: { select: { name: true } }, category: { select: { name: true } } } } } } } },
      feedback: { select: { id: true, recommendationId: true, purchasedSize: true, outcome: true, review: true, createdAt: true } },
      savedBrands: { select: { createdAt: true, brand: { select: { name: true, slug: true } } } },
      sessions: { select: { createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true, userAgent: true } },
      authEvents: { select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 },
    },
  });
  const out = {
    exportedAt: new Date().toISOString(),
    notes: "All measurements are in centimetres and kilograms. 'confidence' on a recommendation is the experimental Fit Match Score, not a probability.",
    ...data,
    sessions: data.sessions.map((s) => ({ ...s, device: deviceLabel(s.userAgent) })),
  };
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="fitsync-data.json"', "cache-control": "no-store" },
  });
});
