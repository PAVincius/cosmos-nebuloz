"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  type Result,
  type Page,
  safeAction,
  buildPage,
  paginationArgs,
} from "../_base";
import {
  AuditFiltersSchema,
  WriteAuditLogSchema,
  type AuditLog,
  type WriteAuditLogInput,
} from "./schema";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listAuditLogs(
  raw?: unknown
): Promise<Result<Page<AuditLog>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = AuditFiltersSchema.parse(raw ?? {});
    const { skip, take } = paginationArgs(filters.page, filters.limit);

    const where = {
      tenantId: ctx.tenantId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      database.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      database.auditLog.count({ where }),
    ]);

    return buildPage(items as AuditLog[], total, filters.page, filters.limit);
  });
}

export async function getAuditLogsByEntity(
  entityType: string,
  entityId: string
): Promise<Result<AuditLog[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const logs = await database.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });

    return logs as AuditLog[];
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function writeAuditLog(
  raw: unknown
): Promise<Result<AuditLog>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = WriteAuditLogSchema.parse(raw);

    const log = await database.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: data.userId ?? ctx.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        diff: data.diff as Record<string, string> ?? undefined,
      },
    });

    revalidatePath("/settings/audit");
    return log as AuditLog;
  });
}

/**
 * Fire-and-forget helper for other actions to log audit entries without
 * blocking the main operation. Errors are swallowed intentionally.
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
        diff: payload.diff as Record<string, string> ?? undefined,
      },
    })
    .catch(() => null);
}
