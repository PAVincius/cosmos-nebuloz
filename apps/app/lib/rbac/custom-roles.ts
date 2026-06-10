import "server-only";
import { database } from "@repo/database";

export async function getCustomPermissions(
  userId: string,
  tenantId: string
): Promise<string[]> {
  const assignments = await database.customRoleAssignment.findMany({
    where: { userId, tenantId },
    include: { customRole: { select: { permissions: true } } },
  });
  return assignments.flatMap((a) => a.customRole.permissions);
}
