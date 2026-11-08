import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { feedbackSchema } from "@/lib/schemas";
export const dynamic = "force-dynamic";

// Actual fit reported by the user is stored separately from the predicted fit in Recommendation.result.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`fb:${user.id}`, 20, 60_000);
  const input = await parseBody(req, feedbackSchema);
  const rec = await db.recommendation.findFirst({ where: { id: input.recommendationId, userId: user.id } });
  if (!rec) throw new ApiError(404, "Recommendation not found.");
  const fb = await db.userFeedback.create({
    data: { userId: user.id, recommendationId: rec.id, purchasedSize: input.purchasedSize, outcome: input.outcome, review: input.review },
  });
  return ok(fb, 201);
});
