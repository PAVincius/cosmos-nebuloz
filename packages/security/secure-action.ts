import "server-only";
import type { Permission } from "@repo/rbac";
import type { ZodSchema } from "zod";

type SecureActionOptions<TInput, TOutput> = {
  schema: ZodSchema<TInput>;
  requiredPermission?: Permission;
  artId?: string;
  resource?: string;
  execute: (
    input: TInput,
    ctx: { userId: string; tenantId: string; role: string }
  ) => Promise<TOutput>;
};

type ForbiddenPayload = {
  code: "INSUFFICIENT_ROLE";
  required: Permission;
  actual: string;
};

export class SecureActionError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR";
  readonly payload?: ForbiddenPayload;

  constructor(
    code: SecureActionError["code"],
    message: string,
    payload?: ForbiddenPayload
  ) {
    super(message);
    this.name = "SecureActionError";
    this.code = code;
    this.payload = payload;
  }
}

export function withSecureAction<TInput, TOutput>(
  options: SecureActionOptions<TInput, TOutput>
) {
  return async (rawInput: unknown, headers: Headers): Promise<TOutput> => {
    const { requireTenantSession } = await import("@repo/auth/server");
    const ctx = await requireTenantSession(headers).catch(() => {
      throw new SecureActionError("UNAUTHORIZED", "Authentication required");
    });

    if (options.requiredPermission) {
      const { getEffectiveRole, hasPermission } = await import("@repo/rbac");
      const role = await getEffectiveRole(
        ctx.userId,
        ctx.tenantId,
        options.artId
      );

      if (!hasPermission(role, options.requiredPermission)) {
        const { database } = await import("@repo/database");
        database.auditLog
          .create({
            data: {
              tenantId: ctx.tenantId,
              action: "authz.denied",
              actorId: ctx.userId,
              actorType: "user",
              metadata: {
                resource: options.resource ?? "unknown",
                requiredPermission: options.requiredPermission,
                actualRole: role,
              },
            },
          })
          .catch(() => {
            // audit log failure is non-blocking
          });

        throw new SecureActionError(
          "FORBIDDEN",
          `Permission '${options.requiredPermission}' required; role '${role}' has no such access`,
          {
            code: "INSUFFICIENT_ROLE",
            required: options.requiredPermission,
            actual: role,
          }
        );
      }
    }

    const validated = options.schema.parse(rawInput);

    return options.execute(validated, {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      role: ctx.role,
    });
  };
}
