import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getEffectiveRole } from "@/lib/rbac/resolve";
import {
  hasPermission,
  type Permission,
} from "../../../../../packages/rbac/src/matrix";

type CanDoProps = {
  permission: Permission;
  artId?: string;
  children: ReactNode;
  fallback?: ReactNode;
};

// Server component — renders children when user has permission, fallback otherwise.
// Inaccessible actions are NOT rendered (not just disabled), per AC-008.
export async function CanDo({
  permission,
  artId,
  children,
  fallback = null,
}: CanDoProps) {
  const ctx = await requireTenantSession(await headers()).catch(() => null);
  if (!ctx) {
    return fallback;
  }

  const role = await getEffectiveRole(ctx.userId, ctx.tenantId, artId);
  if (!hasPermission(role, permission)) {
    return fallback;
  }

  return children;
}
