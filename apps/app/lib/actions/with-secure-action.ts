// Story-032: withSecureAction HOF — session + RBAC + Zod + audit + RLS context

import { requireTenantSession, type TenantContext } from "@repo/auth/server";
import { database, type MemberRole } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import type { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code: 401 | 403 | 409 | 422 | 500;
      details?: unknown;
    };

export type SecureActionConfig<TInput extends z.ZodType> = {
  requiredRole?: MemberRole | MemberRole[];
  schema: TInput;
  transactional?: boolean;
  auditAction: string;
  auditResourceType: string;
  resourceIdFn?: (parsedInput: z.infer<TInput>) => string | undefined;
};

export type ActionContext = TenantContext;

// ─── Role hierarchy ───────────────────────────────────────────────────────────

const ROLE_RANK: Record<MemberRole, number> = {
  ADMIN: 90,
  STE: 80,
  RTE: 70,
  SM: 50,
  PO: 50,
  DEV: 30,
  MEMBER: 10,
};

function hasRole(userRole: MemberRole, required: MemberRole): boolean {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

function hasAnyRole(
  userRole: MemberRole,
  required: MemberRole | MemberRole[]
): boolean {
  if (Array.isArray(required)) {
    return required.some((r) => hasRole(userRole, r));
  }
  return hasRole(userRole, required);
}

// ─── HOF ──────────────────────────────────────────────────────────────────────

export async function withSecureAction<TInput extends z.ZodType, TOutput>(
  config: SecureActionConfig<TInput>,
  rawInput: unknown,
  handler: (
    parsedInput: z.infer<TInput>,
    ctx: TenantContext
  ) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  // AC-007: session check — no AuditLog for missing session (bot noise)
  let ctx: TenantContext;
  try {
    ctx = await requireTenantSession(await headers());
  } catch {
    return { success: false, error: "Unauthorized", code: 401 };
  }

  // AC-003: role check
  if (
    config.requiredRole !== undefined &&
    !hasAnyRole(ctx.role, config.requiredRole)
  ) {
    database.auditLog
      .create({
        data: {
          tenantId: ctx.tenantId,
          action: `${config.auditAction}.unauthorized_attempt`,
          actorId: ctx.userId,
          actorType: "user",
          metadata: { requiredRole: config.requiredRole, userRole: ctx.role },
        },
      })
      .catch((writeErr) => {
        log.error("[withSecureAction] audit log write failed", writeErr);
      });
    return {
      success: false,
      error: "Insufficient permissions",
      code: 403,
    };
  }

  // AC-004: Zod validation
  const parsed = config.schema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation error",
      code: 422,
      details: parsed.error.issues,
    };
  }

  const resourceId = config.resourceIdFn?.(parsed.data);

  // AC-005 + AC-002: execute handler (transactional or not)
  try {
    const execute = async () => handler(parsed.data, ctx);

    const result = config.transactional
      ? await database.$transaction(execute)
      : await execute();

    // AC-006: AuditLog on success
    database.auditLog
      .create({
        data: {
          tenantId: ctx.tenantId,
          action: config.auditAction,
          actorId: ctx.userId,
          actorType: "user",
          metadata: {
            resourceType: config.auditResourceType,
            resourceId: resourceId ?? null,
          },
        },
      })
      .catch((writeErr) => {
        log.error("[withSecureAction] audit log write failed", writeErr);
      });

    return { success: true, data: result };
  } catch (handlerErr) {
    // AC-005: audit log on failure
    database.auditLog
      .create({
        data: {
          tenantId: ctx.tenantId,
          action: `${config.auditAction}.failed`,
          actorId: ctx.userId,
          actorType: "user",
          metadata: {
            resourceType: config.auditResourceType,
            resourceId: resourceId ?? null,
            error:
              handlerErr instanceof Error
                ? handlerErr.message
                : String(handlerErr),
          },
        },
      })
      .catch((writeErr) => {
        log.error("[withSecureAction] audit log write failed", writeErr);
      });

    return { success: false, error: "Internal error", code: 500 };
  }
}
