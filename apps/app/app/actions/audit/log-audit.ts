import { database } from "@repo/database";
import type { WriteAuditLogInput } from "./schema";

/**
 * Fire-and-forget helper for other actions to log audit entries without
 * blocking the main operation. Errors are swallowed intentionally.
 *
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 * Callers must pass a tenantId they already trust (e.g. ctx.tenantId from
 * requireTenantSession), never a caller-supplied value.
 *
 * Usage: logAudit(ctx.tenantId, { userId: ctx.userId, action: "created", ... })
 */
export async function logAudit(
  tenantId: string,
  payload: WriteAuditLogInput & { userId?: string }
): Promise<void> {
  await database.auditLog
    .create({
      data: {
        tenantId,
        userId: payload.userId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        diff: (payload.diff as Record<string, string>) ?? undefined,
      },
    })
    .catch(() => null);
}
