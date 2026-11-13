import { ApiError, ok, route } from "@/lib/api";
import { runRetentionCleanup } from "@/lib/retention";
import { safeEqual } from "@/lib/security/crypto";
export const dynamic = "force-dynamic";

/** Daily retention job (vercel.json cron). Authenticated with CRON_SECRET; refuses to run when it is not configured. */
export const GET = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(given, `Bearer ${secret}`)) throw new ApiError(401, "Unauthorized.");
  return ok(await runRetentionCleanup());
});
