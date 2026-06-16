// Story-036: Notification deduplication and digest dispatch
import { database, Prisma } from "@repo/database";
import { log } from "@repo/observability/log";

const DEDUP_TTL_SECONDS = 3600; // 1h window

export type NotificationParams = {
  tenantId: string;
  userId: string;
  type: string;
  entityId: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
};

async function getDedupKey(params: NotificationParams): Promise<string> {
  return `notification:dedup:${params.type}:${params.entityId}:${params.tenantId}`;
}

export async function sendDedupedNotification(
  params: NotificationParams
): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return createNotification(params);
  }

  const { redis } = await import("@repo/rate-limit");
  const key = await getDedupKey(params);

  const setResult = await redis.set(key, "1", {
    nx: true,
    ex: DEDUP_TTL_SECONDS,
  });

  if (setResult === null) {
    // Already sent recently — just refresh TTL
    await redis.expire(key, DEDUP_TTL_SECONDS);
    return false;
  }

  return createNotification(params);
}

async function createNotification(
  params: NotificationParams
): Promise<boolean> {
  await database.notification
    .create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: (params.metadata ??
          Prisma.DbNull) as Prisma.NullableJsonNullValueInput,
      },
    })
    .catch((err) => {
      log.error("[dedup] notification create failed", err);
    });
  return true;
}

export async function sendBroadcast(
  tenantId: string,
  title: string,
  body: string
): Promise<void> {
  const members = await database.tenantMember.findMany({
    where: { tenantId },
    select: { userId: true },
  });

  // Pin broadcast — max 3 pinned at once (evict oldest if exceeded)
  const existingPinned = await database.notification.findMany({
    where: { tenantId, pinned: true, type: "broadcast" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingPinned.length >= 3) {
    const oldest = existingPinned[0];
    if (oldest) {
      await database.notification.delete({ where: { id: oldest.id } });
    }
  }

  await database.notification.createMany({
    data: members.map((m) => ({
      tenantId,
      userId: m.userId,
      type: "broadcast",
      title,
      body,
      pinned: true,
    })),
  });
}
