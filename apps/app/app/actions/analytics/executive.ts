"use server";

// Story-029 AC-001/AC-007/AC-008: Executive Dashboard KPIs + ART table + anomaly feed + 5-min cache

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { z } from "zod";
import {
  buildExecutiveDashboardData,
  EXECUTIVE_CACHE_TTL,
  type ExecutiveDashboardPayload,
  executiveCacheKey,
} from "@/lib/analytics/executive-dashboard";
import { type Result, safeAction } from "../_base";

const ExecutiveDashboardSchema = z.object({
  artIds: z.array(z.string().cuid()).min(1).max(20).optional(),
});

export async function getExecutiveDashboard(
  raw?: unknown
): Promise<Result<ExecutiveDashboardPayload>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = ExecutiveDashboardSchema.parse(raw ?? {});

    const { redis } = await import("@repo/rate-limit");
    const cacheKey = executiveCacheKey(tenantId, input.artIds);

    const cached = await redis.get<ExecutiveDashboardPayload>(cacheKey);
    if (cached) {
      database.auditLog
        .create({
          data: {
            tenantId,
            actorId: userId,
            actorType: "user",
            action: "analytics.dashboard.viewed",
            metadata: { fromCache: true },
          },
        })
        .catch(() => {});
      return { ...cached, fromCache: true };
    }

    const result = await buildExecutiveDashboardData(tenantId, input.artIds);
    await redis.set(cacheKey, result, { ex: EXECUTIVE_CACHE_TTL });

    database.auditLog
      .create({
        data: {
          tenantId,
          actorId: userId,
          actorType: "user",
          action: "analytics.dashboard.viewed",
          metadata: { fromCache: false },
        },
      })
      .catch((e) => log.error("[executive-dashboard] audit failed", e));

    return result;
  });
}
