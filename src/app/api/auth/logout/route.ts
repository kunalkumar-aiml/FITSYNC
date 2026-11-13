import { ok, route } from "@/lib/api";
import { getSession, endCurrentSession } from "@/lib/session";
import { logAuthEvent } from "@/lib/audit";
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const s = await getSession();
  await endCurrentSession();
  if (s.status === "active") await logAuthEvent("LOGOUT", { userId: s.user.id, headers: req.headers });
  return ok({ loggedOut: true });
});
