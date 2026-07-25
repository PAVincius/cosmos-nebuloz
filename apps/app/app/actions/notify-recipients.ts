import "server-only";
import type { MemberRole } from "@repo/database";
import { database } from "@repo/database";

/**
 * Returns all userIds with any of the given roles within a tenant.
 * Used by the event system for fire-and-forget notification targeting.
 *
 * Note: Team.members is Json? (no FK to userId), so team-scoped SM lookup
 * is not possible from schema. We notify all matching roles tenant-wide.
 * Returns [] on error — never throws.
 */
export async function findRecipientsByRole(
  tenantId: string,
  roles: MemberRole[]
): Promise<string[]> {
  try {
    const members = await database.tenantMember.findMany({
      where: { tenantId, role: { in: roles } },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  } catch {
    return [];
  }
}

/** Merge multiple userId arrays into a unique set. */
export function dedupeRecipients(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}
