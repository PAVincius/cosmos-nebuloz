import { log } from "@repo/observability/log";
import { executiveCacheKey } from "@/lib/analytics/executive-dashboard";

/**
 * AC-007: invalidate cache when new FlowMetricSnapshot is computed.
 *
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 * Callers must pass a tenantId they already trust, never a caller-supplied
 * value.
 */
export async function invalidateExecutiveDashboardCache(
  tenantId: string
): Promise<void> {
  try {
    const { redis } = await import("@repo/rate-limit");
    await redis.del(executiveCacheKey(tenantId));
    log.info("[executive-dashboard] cache invalidated", { tenantId });
  } catch (e) {
    log.error("[executive-dashboard] cache invalidation failed", {
      error: String(e),
    });
  }
}
