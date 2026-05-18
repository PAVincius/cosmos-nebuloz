/**
 * RBAC enforcement for server actions (`enforce` + re-exports).
 * Policy logic lives in `permissions-policy.ts` (unit-testable).
 */
import { AuthError } from "@repo/auth/server";
import type { MemberRole as DbMemberRole } from "@repo/database";
import {
  can as canPolicy,
  type EntityType,
  type PolicyAction,
} from "./permissions-policy";

export type { EntityType, PolicyAction } from "./permissions-policy";
export { POLICIES } from "./permissions-policy";

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
