import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { aggregateSettled, overallStatus } from "@/lib/platform/health";

async function getDbMetrics() {
  const start = performance.now();
  await database.$queryRaw`SELECT 1`;
  const latencyMs = performance.now() - start;
  return { latencyMs: Math.round(latencyMs * 100) / 100, pingOk: true };
}

async function getRedisMetrics() {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { available: false };
  }
  const { redis } = await import("@repo/rate-limit");
  const start = performance.now();
  await redis.set("__health_ping__", "1", { ex: 5 });
  const latencyMs = performance.now() - start;
  return { latencyMs: Math.round(latencyMs * 100) / 100, available: true };
}

async function getInngestMetrics() {
  const url = process.env.INNGEST_EVENT_KEY
    ? "https://api.inngest.com/v1/apps"
    : null;
  if (!url) {
    return { configured: false };
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY ?? ""}`,
    },
    signal: AbortSignal.timeout(3000),
  });
  return { configured: true, status: res.status, ok: res.ok };
}

async function getFallbackQueueDepth() {
  const count = await database.jobFallbackQueue.count({
    where: { status: "PENDING" },
  });
  return { pendingJobs: count };
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await database.tenantMember.findFirst({
    where: { userId: session.user.id },
    select: { role: true },
  });

  if (member?.role !== "ADMIN" && member?.role !== "STE") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [dbResult, redisResult, inngestResult, fallbackResult] =
    await Promise.allSettled([
      getDbMetrics(),
      getRedisMetrics(),
      getInngestMetrics(),
      getFallbackQueueDepth(),
    ]);

  const metrics = {
    db: aggregateSettled(dbResult),
    redis: aggregateSettled(redisResult),
    inngest: aggregateSettled(inngestResult),
    fallbackQueue: aggregateSettled(fallbackResult),
  };

  const overall = overallStatus(Object.values(metrics));
  return Response.json(
    { overall, metrics, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    }
  );
}
