import { redirect } from "next/navigation";
import { ApiError } from "./api";
import { getSession, type SessionUser } from "./session";

/**
 * Authorization helpers. Identity and role always come from the server-side session and the database row behind it,
 * never from anything the browser sends. Every private query must use the returned user.id.
 */
export async function getUser(): Promise<SessionUser | null> {
  const s = await getSession();
  return s.status === "active" ? s.user : null;
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (s.status === "expired") throw new ApiError(401, "Your session has expired. Please log in again.", { code: "SESSION_EXPIRED" });
  if (s.status !== "active") throw new ApiError(401, "Please log in to continue.");
  return s.user;
}

export async function requireSession() {
  const s = await getSession();
  if (s.status !== "active") throw new ApiError(401, "Please log in to continue.");
  return s;
}

/** Every admin API route calls this itself; middleware and hidden links are not relied on. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Admin access required.");
  return user;
}

/** For server-rendered pages: redirect instead of throwing. */
export async function requirePageUser(next?: string): Promise<SessionUser> {
  const s = await getSession();
  if (s.status === "active") return s.user;
  const q = new URLSearchParams();
  if (next) q.set("next", next);
  if (s.status === "expired") q.set("expired", "1");
  redirect(`/login${q.size ? `?${q}` : ""}`);
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser("/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
