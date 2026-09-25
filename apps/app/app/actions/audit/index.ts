"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  buildPage,
  type Page,
  paginationArgs,
  type Result,
  safeAction,
} from "../_base";
import {
  AuditFiltersSchema,
  type AuditLog,
  WriteAuditLogSchema,
} from "./schema";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listAuditLogs(
  raw?: unknown
): Promise<Result<Page<AuditLog>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = AuditFiltersSchema.parse(raw ?? {});
    const { skip, take } = paginationArgs(filters.page, filters.limit);

    // entityType terminado em "." é prefixo (ex.: "meridian.") — cada produto
    // grava vários entityType concretos sob o mesmo prefixo, sem um valor
    // fixo por tela (ver atrito registrado por Meridian dogfood M8).
    const entityTypeFilter = filters.entityType?.endsWith(".")
      ? { startsWith: filters.entityType }
      : filters.entityType;

    const where = {
      tenantId: ctx.tenantId,
      ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
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

    if (filters.cursor) {
      const items = await database.auditLog.findMany({
        where,
        cursor: { id: filters.cursor },
        skip: 1,
        take,
        orderBy: { createdAt: "desc" },
      });
      const nextCursor = items.length === take ? items.at(-1)?.id : undefined;
      return {
        items: items as AuditLog[],
        meta: {
          total: -1,
          page: 1,
          limit: filters.limit,
          pageCount: -1,
          hasNext: items.length === take,
          hasPrev: true,
          nextCursor,
        },
      };
    }

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

export async function writeAuditLog(raw: unknown): Promise<Result<AuditLog>> {
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
        diff: (data.diff as Record<string, string>) ?? undefined,
      },
    });

    revalidatePath("/settings/audit");
    return log as AuditLog;
  });
}
