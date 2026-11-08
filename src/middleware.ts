import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, COOKIE } from "@/lib/session";

const PROTECTED = ["/dashboard", "/profile", "/recommend", "/compare", "/history", "/settings", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF defence in depth (cookies are also SameSite=Lax): same-origin only for mutating API calls.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: { message: "Cross-origin request blocked." } }, { status: 403 });
    }
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const userId = await verifySessionToken(req.cookies.get(COOKIE)?.value);
    if (!userId) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|icons|favicon.ico|sw.js|manifest.webmanifest).*)"] };
