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
  CreateNotificationSchema,
  type Notification,
  NotificationFiltersSchema,
  type NotificationType,
} from "./schema";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listNotifications(
  raw?: unknown
): Promise<Result<Page<Notification>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = NotificationFiltersSchema.parse(raw ?? {});
    const { skip, take } = paginationArgs(filters.page, filters.limit);

    const where = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      ...(filters.read !== undefined ? { read: filters.read } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    };

    const [items, total] = await Promise.all([
      database.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      database.notification.count({ where }),
    ]);

    return buildPage(
      items as Notification[],
      total,
      filters.page,
      filters.limit
    );
  });
}

export async function getUnreadCount(): Promise<Result<number>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.notification.count({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        read: false,
      },
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function markAsRead(id: string): Promise<Result<Notification>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const notification = await database.notification.findFirst({
      where: { id, tenantId: ctx.tenantId, userId: ctx.userId },
    });
    if (!notification) {
      throw new Error("Notificação não encontrada.");
    }

    const updated = await database.notification.update({
      where: { id },
      data: { read: true },
    });

    revalidatePath("/notifications");
    return updated as Notification;
  });
}

export async function markAllAsRead(): Promise<Result<{ count: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const result = await database.notification.updateMany({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        read: false,
      },
      data: { read: true },
    });

    revalidatePath("/notifications");
    return { count: result.count };
  });
}

export async function createNotification(
  raw: unknown
): Promise<Result<Notification>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateNotificationSchema.parse(raw);

    const notification = await database.notification.create({
      data: {
        tenantId: ctx.tenantId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        metadata: data.metadata
          ? (data.metadata as Record<string, string>)
          : undefined,
        read: false,
      },
    });

    revalidatePath("/notifications");
    return notification as Notification;
  });
}

/**
 * Fire-and-forget helper for other actions to create notifications without
 * requiring a full session context (e.g., system events, risk alerts).
 */
export async function pushNotification(
  tenantId: string,
  payload: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  database.notification
    .create({
      data: {
        tenantId,
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        metadata: payload.metadata
          ? (payload.metadata as Record<string, string>)
          : undefined,
        read: false,
      },
    })
    .catch(() => null);
}

export async function deleteNotification(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const notification = await database.notification.findFirst({
      where: { id, tenantId: ctx.tenantId, userId: ctx.userId },
    });
    if (!notification) {
      throw new Error("Notificação não encontrada.");
    }

    await database.notification.delete({ where: { id } });

    revalidatePath("/notifications");
    return { id };
  });
}

export async function deleteReadNotifications(): Promise<
  Result<{ count: number }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const result = await database.notification.deleteMany({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        read: true,
      },
    });

    revalidatePath("/notifications");
    return { count: result.count };
  });
}

// ─── Legacy helpers (plain return, no Result wrapper) ─────────────────────────

/** Convenience helper that returns notifications array directly (no Result wrapper). */
export async function getNotifications(limit = 50): Promise<Notification[]> {
  const ctx = await requireTenantSession(await headers());
  const items = await database.notification.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return items as Notification[];
}

/** Returns unread count directly (no Result wrapper). */
export async function getUnreadCountRaw(): Promise<number> {
  const ctx = await requireTenantSession(await headers());
  return database.notification.count({
    where: { tenantId: ctx.tenantId, userId: ctx.userId, read: false },
  });
}
