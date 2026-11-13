import type { AuthEventType, Prisma } from "@prisma/client";
import { db } from "./db";
import { ipHashOf, userAgentOf } from "./security/request-meta";

/** Security event. Never pass passwords, tokens, measurements or other payloads here. */
export async function logAuthEvent(type: AuthEventType, opts: { userId?: string | null; headers?: Headers } = {}) {
  try {
    await db.authEvent.create({
      data: { type, userId: opts.userId ?? null, ipHash: opts.headers ? ipHashOf(opts.headers) : null, userAgent: opts.headers ? userAgentOf(opts.headers) : null },
    });
  } catch (e) {
    console.error("[audit] could not record auth event", type, (e as Error).message);
  }
}

/** Administrative change. `details` must describe the change, not copy personal data. */
export function logAdmin(actor: { id: string; email: string }, action: string, targetType: string, targetId: string | null, details: Record<string, unknown> = {}) {
  return db.adminAuditLog.create({
    data: { actorId: actor.id, actorEmail: actor.email, action, targetType, targetId, details: details as Prisma.InputJsonValue },
  });
}
