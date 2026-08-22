/**
 * RBAC enforcement for server actions (`enforce` + re-exports).
 * Policy logic lives in `permissions-policy.ts` (unit-testable).
 */
import { AuthError } from "@repo/auth/server";
import type { MemberRole as DbMemberRole } from "@repo/database";
import { database } from "@repo/database";
import {
  can as canPolicy,
  type EntityType,
  type PolicyAction,
} from "./permissions-policy";

export type { EntityType, PolicyAction } from "./permissions-policy";

export function can(
  role: DbMemberRole,
  entity: EntityType,
  action: PolicyAction
): boolean {
  return canPolicy(role, entity, action);
}

export function enforce(
  role: DbMemberRole,
  entity: EntityType,
  action: PolicyAction
): void {
  if (!can(role, entity, action)) {
    throw new AuthError(
      "FORBIDDEN",
      `${role} não tem permissão para '${action}' em ${entity}`
    );
  }
}

export type EnforceWithPAEParams = {
  tenantId: string;
  userId: string;
  role: DbMemberRole;
  entity: EntityType;
  action: PolicyAction;
};

export async function enforceWithPAE({
  tenantId,
  userId,
  role,
  entity,
  action,
}: EnforceWithPAEParams): Promise<void> {
  // Fast path: can() is pure sync — no DB on happy path
  if (can(role, entity, action)) {
    return;
  }

  // Slow path: check for active PAE grant
  const grant = await database.accessExceptionRequest.findFirst({
    where: {
      tenantId,
      requesterId: userId,
      entityType: entity,
      action,
      status: "APPROVED",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!grant) {
    throw new AuthError(
      "FORBIDDEN",
      `${role} não tem permissão para '${action}' em ${entity}`
    );
  }
}
