import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { readinessProblems } from "@/lib/readiness";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness. 200 only when the database is reachable, its schema is current and required secrets are set.
 * 503 lists problem CODES (never values) so a misconfigured deployment is obvious from one request instead of
 * showing up as "Something went wrong" at sign-up. Add ?fresh=1 to bypass the 30 s cache.
 */
export const GET = route(async (req: Request) => {
  const problems = await readinessProblems({ fresh: new URL(req.url).searchParams.has("fresh") });
  const time = new Date().toISOString();
  if (problems.length) return NextResponse.json({ data: { status: "misconfigured", problems, time } }, { status: 503 });
  return NextResponse.json({ data: { status: "ok", time } });
});
