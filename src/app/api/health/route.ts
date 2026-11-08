import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await db.$queryRaw`SELECT 1`;
  return ok({ status: "ok", time: new Date().toISOString() });
});
