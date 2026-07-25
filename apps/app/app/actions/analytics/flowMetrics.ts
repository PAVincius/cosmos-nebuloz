"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import {
  computeBenchmarkComparisons,
  type ForecastResult,
  monteCarloForecast,
} from "@/lib/analytics/monte-carlo";
import { type Result, safeAction } from "../_base";

const FORECAST_CACHE_TTL = 3600; // 1h in seconds
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h

// ─── getForecast ──────────────────────────────────────────────────────────────

const getForecastSchema = z.object({
  teamId: z.string().min(1),
  remainingItems: z.number().int().positive(),
  piPlanId: z.string().optional(),
});

export async function getForecast(
  raw: unknown
): Promise<Result<ForecastResult & { fromCache: boolean }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getForecastSchema.parse(raw);

    // Fetch historical throughput (closed sprints for this team)
    const sprints = await database.sprint.findMany({
      where: {
        tenantId,
        teamId: input.teamId,
        status: "CLOSED",
        velocity: { not: null },
      },
      orderBy: { closedAt: "desc" },
      take: 8,
      select: { velocity: true },
    });

    if (sprints.length === 0) {
      throw new Error(
        "INSUFFICIENT_DATA: no closed sprints with velocity data"
      );
    }

    const throughput = sprints.map((s) => s.velocity as number);

    // AC-004: 1h Redis cache
    const { redis } = await import("@repo/rate-limit");
    const historyHash = throughput.join(",");
    const cacheKey = `analytics:forecast:${input.teamId}:${input.remainingItems}:${historyHash}`;

    const cached = await redis.get<ForecastResult>(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const result = monteCarloForecast(throughput, input.remainingItems);
    await redis.set(cacheKey, result, { ex: FORECAST_CACHE_TTL });

    return { ...result, fromCache: false };
  });
}

// ─── getFlowMetrics ───────────────────────────────────────────────────────────

const getFlowMetricsSchema = z.object({
  artId: z.string().optional(),
  teamId: z.string().optional(),
  piPlanId: z.string().optional(),
  period: z.enum(["sprint", "pi", "quarter"]).default("pi"),
});

export async function getFlowMetrics(raw: unknown): Promise<
  Result<{
    metrics: {
      velocity: number;
      cycleTimeDays: number;
      leadTimeDays: number;
      throughput: number;
      wip: number;
      flowEfficiency: number;
    };
    isStale: boolean;
    lastUpdatedAt: Date | null;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getFlowMetricsSchema.parse(raw);

    const snapshot = await database.flowMetricSnapshot.findFirst({
      where: {
        tenantId,
        scope: input.teamId ? "team" : "art",
        scopeId: (input.teamId ?? input.artId) as string,
        period: input.period,
      },
      orderBy: { recordedAt: "desc" },
      select: {
        flowVelocityTotal: true,
        flowTimeMedianHours: true,
        flowLoadCurrent: true,
        flowEfficiency: true,
        recordedAt: true,
      },
    });

    const lastUpdatedAt = snapshot?.recordedAt ?? null;
    const isStale = lastUpdatedAt
      ? Date.now() - lastUpdatedAt.getTime() > STALE_THRESHOLD_MS
      : true;

    const cycleTimeDays = (snapshot?.flowTimeMedianHours ?? 0) / 24;

    return {
      metrics: {
        velocity: snapshot?.flowVelocityTotal ?? 0,
        cycleTimeDays,
        leadTimeDays: cycleTimeDays * 1.2, // lead time estimated as 120% of cycle time
        throughput: snapshot?.flowVelocityTotal ?? 0,
        wip: snapshot?.flowLoadCurrent ?? 0,
        flowEfficiency: snapshot?.flowEfficiency ?? 0,
      },
      isStale,
      lastUpdatedAt,
    };
  });
}

// ─── getBenchmarkComparison ───────────────────────────────────────────────────

const getBenchmarkComparisonSchema = z.object({
  artId: z.string().min(1),
  priorPiPlanId: z.string().min(1),
  currentPiPlanId: z.string().min(1),
});

export async function getBenchmarkComparison(raw: unknown): Promise<
  Result<{
    comparisons: ReturnType<typeof computeBenchmarkComparisons>;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getBenchmarkComparisonSchema.parse(raw);

    // Fetch team snapshots for both PIs
    const [priorSnaps, currentSnaps] = await Promise.all([
      database.flowMetricSnapshot.findMany({
        where: {
          tenantId,
          scope: "team",
          period: "pi",
          periodRef: input.priorPiPlanId,
        },
        select: { scopeId: true, flowTimeMedianHours: true },
      }),
      database.flowMetricSnapshot.findMany({
        where: {
          tenantId,
          scope: "team",
          period: "pi",
          periodRef: input.currentPiPlanId,
        },
        select: { scopeId: true, flowTimeMedianHours: true },
      }),
    ]);

    const priorMap = new Map(
      priorSnaps.map((s) => [s.scopeId, s.flowTimeMedianHours])
    );
    const comparisons = computeBenchmarkComparisons(
      currentSnaps
        .filter((s) => priorMap.has(s.scopeId))
        .map((s) => ({
          teamId: s.scopeId,
          priorCycleTime: (priorMap.get(s.scopeId) ?? 0) / 24,
          currentCycleTime: s.flowTimeMedianHours / 24,
        }))
    );

    return { comparisons };
  });
}
