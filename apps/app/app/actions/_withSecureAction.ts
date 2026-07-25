import "server-only";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { getCustomPermissions } from "@/lib/rbac/custom-roles";
import { getEffectiveRole } from "@/lib/rbac/resolve";
import {
  hasPermission,
  type Permission,
  type SaFeRole,
} from "../../../../packages/rbac/src/matrix";
import { err, type Result, safeAction, toActionError } from "./_base";

type SecureActionCtx = {
  userId: string;
  tenantId: string;
  role: SaFeRole;
};

type WithSecureActionOptions = {
  permission: Permission;
  entity: string;
  artId?: string;
};

export async function withSecureAction<T>(
  options: WithSecureActionOptions,
  fn: (ctx: SecureActionCtx) => Promise<T>
): Promise<Result<T>> {
  let ctx: { userId: string; tenantId: string };
  let role: SaFeRole;

  try {
    ctx = await requireTenantSession(await headers());
    role = await getEffectiveRole(ctx.userId, ctx.tenantId, options.artId);
  } catch (e) {
    return err(toActionError(e));
  }

  let permitted = hasPermission(role, options.permission);

  if (!permitted) {
    const customPerms = await getCustomPermissions(
      ctx.userId,
      ctx.tenantId
    ).catch(() => [] as string[]);
    permitted =
      customPerms.includes(options.permission) || customPerms.includes("*");
  }

  if (!permitted) {
    database.auditLog
      .create({
        data: {
          tenantId: ctx.tenantId,
          actorId: ctx.userId,
          actorType: "user",
          action: "authz.denied",
          entityType: options.entity,
          metadata: { required: options.permission, actual: role },
        },
      })
      .catch((e) => {
        log.error("[withSecureAction] audit log failed", e);
      });

    return err(
      `INSUFFICIENT_ROLE: required ${options.permission}, actual ${role}`,
      "INSUFFICIENT_ROLE"
    );
  }

  return safeAction(() =>
    fn({ userId: ctx.userId, tenantId: ctx.tenantId, role })
  );
}
