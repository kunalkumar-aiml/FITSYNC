/** Pure rules for administrator actions on accounts (unit-tested in __tests__/admin-policy.test.ts). */
export type TargetUser = { id: string; role: "USER" | "ADMIN"; emailVerifiedAt: Date | null; disabledAt: Date | null };

export function userChangeProblem(i: { actorId: string; target: TargetUser; activeAdmins: number; role?: "USER" | "ADMIN"; disabled?: boolean }): string | null {
  if (i.role === undefined && i.disabled === undefined) return "Nothing to change.";
  if (i.target.id === i.actorId) return "You can’t change your own role or status. Ask another administrator.";
  if (i.role === "ADMIN" && i.target.role !== "ADMIN") {
    if (!i.target.emailVerifiedAt) return "Only accounts with a confirmed email address can become administrators.";
    if (i.target.disabledAt) return "Re-enable the account before making it an administrator.";
  }
  const removesActiveAdmin = i.target.role === "ADMIN" && !i.target.disabledAt && (i.role === "USER" || i.disabled === true);
  if (removesActiveAdmin && i.activeAdmins <= 1) return "This is the last active administrator. Promote someone else first.";
  return null;
}

/** Bootstrap rules for scripts/admin-bootstrap.ts. */
export type BootstrapPlan =
  | { action: "refuse"; reason: string }
  | { action: "create" }
  | { action: "promote"; userId: string };

export function planBootstrap(i: { adminCount: number; existing: { id: string; role: "USER" | "ADMIN" } | null; confirmExisting: boolean }): BootstrapPlan {
  if (i.adminCount > 0) return { action: "refuse", reason: "An administrator already exists, so bootstrap is closed. Existing admins can promote verified accounts in Admin → Users." };
  if (!i.existing) return { action: "create" };
  if (!i.confirmExisting) return { action: "refuse", reason: "An account with this email already exists. Re-run with --promote-existing only if you control that account." };
  return { action: "promote", userId: i.existing.id };
}
