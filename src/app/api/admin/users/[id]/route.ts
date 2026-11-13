import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminUserUpdateSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { revokeAllSessions } from "@/lib/session";
import { userChangeProblem } from "@/lib/admin-policy";
export const dynamic = "force-dynamic";

/**
 * Change another account's role or disable / re-enable it. Policy (lib/admin-policy.ts):
 *  - an admin never changes their own role or disables themselves;
 *  - only accounts with a VERIFIED email can be promoted to ADMIN;
 *  - the last active admin cannot be demoted or disabled;
 *  - disabling signs the account out everywhere.
 * Every change needs explicit confirmation and a reason, and is written to the audit log.
 */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const params = await ctx.params;
  const admin = await requireAdmin();
  await rateLimit(`admin-user:${admin.id}`, 20, 10 * 60_000);
  const input = await parseBody(req, adminUserUpdateSchema);
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw new ApiError(404, "User not found.");
  const activeAdmins = await db.user.count({ where: { role: "ADMIN", disabledAt: null } });
  const problem = userChangeProblem({ actorId: admin.id, target, activeAdmins, role: input.role, disabled: input.disabled });
  if (problem) throw new ApiError(400, problem);
  const updated = await db.user.update({
    where: { id: target.id },
    data: { ...(input.role ? { role: input.role } : {}), ...(input.disabled !== undefined ? { disabledAt: input.disabled ? new Date() : null } : {}) },
    select: { id: true, email: true, role: true, disabledAt: true },
  });
  if (input.disabled === true || (input.role === "USER" && target.role === "ADMIN")) await revokeAllSessions(target.id);
  await logAdmin(admin, input.role && input.role !== target.role ? "user.role.change" : "user.status.change", "User", target.id, {
    roleBefore: target.role, roleAfter: updated.role, disabledBefore: !!target.disabledAt, disabledAfter: !!updated.disabledAt, reason: input.reason,
  });
  return ok(updated);
});
