import { cookies } from "next/headers";
import { ok, route } from "@/lib/api";
import { cookieSecure } from "@/lib/env";
import { csrfCookieName } from "@/lib/security/cookie-names";
import { newCsrfToken } from "@/lib/security/csrf";
export const dynamic = "force-dynamic";

/** Returns the double-submit CSRF token, issuing the cookie if the browser does not have one yet. */
export const GET = route(async () => {
  let token = (await cookies()).get(csrfCookieName())?.value;
  if (!token) {
    token = newCsrfToken();
    (await cookies()).set(csrfCookieName(), token, { httpOnly: false, secure: cookieSecure(), sameSite: "lax", path: "/" });
  }
  return ok({ token });
});
