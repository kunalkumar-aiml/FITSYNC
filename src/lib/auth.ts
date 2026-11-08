import bcrypt from "bcryptjs";
import { db } from "./db";
import { currentUserId } from "./session";
import { redirect } from "next/navigation";
import { ApiError } from "./api";

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export async function getUser() {
  const id = await currentUserId();
  if (!id) return null;
  return db.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new ApiError(401, "Please log in to continue.");
  return user;
}

/** Role is read from the database on every call, never from the token. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Admin access required.");
  return user;
}

/** For server-rendered pages: redirect instead of throwing. (Middleware already redirects; this is defence in depth.) */
export async function requirePageUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
