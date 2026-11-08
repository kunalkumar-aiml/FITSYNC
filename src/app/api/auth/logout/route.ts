import { ok, route } from "@/lib/api";
import { clearSessionCookie } from "@/lib/session";
export const dynamic = "force-dynamic";
export const POST = route(async () => {
  clearSessionCookie();
  return ok({ loggedOut: true });
});
