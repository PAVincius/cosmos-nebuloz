import { database } from "@repo/database";
import type { NotificationType } from "./schema";

/**
 * Fire-and-forget helper for other actions to create notifications without
 * requiring a full session context (e.g., system events, risk alerts).
 *
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 * Callers must pass a tenantId they already trust, never a caller-supplied
 * value.
 */
export async function pushNotification(
  tenantId: string,
  payload: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  database.notification
    .create({
      data: {
        tenantId,
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        metadata: payload.metadata
          ? (payload.metadata as Record<string, string>)
          : undefined,
        read: false,
      },
    })
    .catch(() => null);
}
