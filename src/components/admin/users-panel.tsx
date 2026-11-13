"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "../confirm-dialog";
import { useAdminAction } from "./shared";

type U = { id: string; email: string; name: string | null; role: "USER" | "ADMIN"; createdAt: string; emailVerifiedAt: string | null; lastLoginAt: string | null; disabledAt: string | null; _count: { recommendations: number; feedback: number } };
type Change = { user: U; role?: "USER" | "ADMIN"; disabled?: boolean; label: string };
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "never");

export function UsersPanel({ users, meId, q }: { users: U[]; meId: string; q: string }) {
  const router = useRouter();
  const { busy, act, api } = useAdminAction();
  const [change, setChange] = useState<Change | null>(null);
  const [reason, setReason] = useState("");
  return (
    <div>
      <form className="flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("q") ?? ""); router.push(`/admin/users${v ? `?q=${encodeURIComponent(v)}` : ""}`); }}>
        <input name="q" defaultValue={q} className="input !h-10" placeholder="Search email or name" aria-label="Search users" />
        <button className="btn btn-ghost !h-10">Search</button>
      </form>
      <div className="mt-6 overflow-x-auto">
        <table className="table-x min-w-[52rem]">
          <thead><tr><th>Account</th><th>Role</th><th>Email</th><th>Joined</th><th>Last login</th><th>Activity</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><span className="font-medium">{u.email}</span>{u.name && <span className="block text-xs text-muted">{u.name}</span>}{u.disabledAt && <span className="tag mt-1 border-bad/40 text-bad">Disabled</span>}</td>
                <td>{u.role === "ADMIN" ? <span className="tag border-ink text-ink">Admin</span> : "User"}</td>
                <td>{u.emailVerifiedAt ? <span className="text-good">Confirmed</span> : <span className="text-muted">Not confirmed</span>}</td>
                <td className="text-muted whitespace-nowrap">{d(u.createdAt)}</td>
                <td className="text-muted whitespace-nowrap">{d(u.lastLoginAt)}</td>
                <td className="text-muted">{u._count.recommendations} saved, {u._count.feedback} reports</td>
                <td className="whitespace-nowrap">{u.id === meId ? <span className="text-xs text-muted">You</span> : (
                  <span className="flex gap-1">
                    {u.role === "USER"
                      ? <button type="button" className="btn btn-quiet btn-sm" disabled={!u.emailVerifiedAt || !!u.disabledAt} title={!u.emailVerifiedAt ? "Email not confirmed" : undefined} onClick={() => { setChange({ user: u, role: "ADMIN", label: "Make administrator" }); setReason(""); }}>Make admin</button>
                      : <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setChange({ user: u, role: "USER", label: "Remove admin role" }); setReason(""); }}>Remove admin</button>}
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setChange({ user: u, disabled: !u.disabledAt, label: u.disabledAt ? "Re-enable account" : "Disable account" }); setReason(""); }}>{u.disabledAt ? "Re-enable" : "Disable"}</button>
                  </span>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="mt-4 text-sm text-muted">No accounts match.</p>}
      </div>
      <ConfirmDialog open={!!change} title={change?.label ?? ""} tone={change?.disabled || change?.role === "USER" ? "danger" : "primary"} confirmLabel={change?.label ?? "Confirm"} busy={busy === "user"}
        confirmDisabled={reason.trim().length < 3} onClose={() => setChange(null)}
        onConfirm={() => change && act("user", () => api(`/api/admin/users/${change.user.id}`, { method: "PATCH", json: { ...(change.role ? { role: change.role } : {}), ...(change.disabled !== undefined ? { disabled: change.disabled } : {}), confirm: true, reason } }), "Account updated").then(() => setChange(null))}>
        <p>{change?.user.email}</p>
        {change?.disabled && <p>The account is signed out everywhere and can’t log in until re-enabled. Its data is kept.</p>}
        {change?.role === "ADMIN" && <p>Administrators can change brand data, verify charts and manage accounts.</p>}
        <div><label className="label !text-ink" htmlFor="reason">Reason (saved to the audit log)</label><input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>
      </ConfirmDialog>
    </div>
  );
}
