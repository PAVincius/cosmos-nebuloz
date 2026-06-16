"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database, type Prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

// AC-002: >20% over capacity requires override
const OVERCOMMITMENT_THRESHOLD = 1.2;
// AC-007: >2σ below mean triggers VELOCITY_DROP
const VELOCITY_SIGMA_MULTIPLIER = 2;
const MIN_VELOCITY_HISTORY = 3;
// AC-008: >30% mid-sprint point increase triggers ESTIMATION_DRIFT
const ESTIMATION_DRIFT_THRESHOLD = 1.3;

type Tx = Parameters<Parameters<typeof database.$transaction>[0]>[0];

async function createSprintAnomaly(opts: {
  tenantId: string;
  scopeId: string;
  rule: string;
  severity: string;
  metric: string;
  delta: number;
  metadata?: Record<string, unknown>;
  tx: Tx;
}): Promise<void> {
  const run = await opts.tx.anomalyDetectionRun.create({
    data: {
      tenantId: opts.tenantId,
      scope: "team",
      scopeId: opts.scopeId,
      snapshotId: "sprint_lifecycle",
      trigger: "sprint_lifecycle",
      status: "COMPLETED",
    },
    select: { id: true },
  });
  await opts.tx.anomaly.create({
    data: {
      tenantId: opts.tenantId,
      runId: run.id,
      rule: opts.rule,
      severity: opts.severity,
      metric: opts.metric,
      delta: opts.delta,
      metadata: (opts.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

function velocityStats(velocities: number[]): { mean: number; stdDev: number } {
  const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const stdDev = Math.sqrt(
    velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length
  );
  return { mean, stdDev };
}

// ─── activateSprint ──────────────────────────────────────────────────────────

const activateSprintSchema = z.object({
  sprintId: z.string().min(1),
  overcommitmentOverride: z.boolean().optional(),
  overcommitmentJustification: z.string().optional(),
});

export async function activateSprint(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = activateSprintSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const sprint = await tx.sprint.findFirstOrThrow({
        where: { id: input.sprintId, tenantId },
        select: {
          id: true,
          teamId: true,
          capacity: true,
          status: true,
        },
      });

      if (sprint.status !== "PLANNING") {
        throw new Error(
          `INVALID_TRANSITION: sprint is ${sprint.status}, expected PLANNING`
        );
      }

      // AC-001: One ACTIVE sprint per team
      const activeSprint = await tx.sprint.findFirst({
        where: { teamId: sprint.teamId, tenantId, status: "ACTIVE" },
        select: { id: true },
      });
      if (activeSprint) {
        throw new Error(
          `ACTIVE_SPRINT_EXISTS:${activeSprint.id}:Team already has an active sprint`
        );
      }

      // AC-002: Overcommitment guard (>20% over capacity)
      if (sprint.capacity) {
        const committedPoints = await tx.story.aggregate({
          where: { sprintId: sprint.id, tenantId },
          _sum: { storyPoints: true },
        });
        const committed = committedPoints._sum.storyPoints ?? 0;
        const ratio = sprint.capacity > 0 ? committed / sprint.capacity : 0;

        if (ratio > OVERCOMMITMENT_THRESHOLD) {
          if (!input.overcommitmentOverride) {
            throw new Error(
              `OVERCOMMITMENT_REQUIRES_OVERRIDE:${Math.round((ratio - 1) * 100)}% over capacity`
            );
          }
          await createSprintAnomaly({
            tenantId,
            scopeId: sprint.teamId,
            rule: "SCOPE_CREEP",
            severity: "MEDIUM",
            metric: "sprint_load",
            delta: ratio - 1,
            metadata: { sprintId: sprint.id, ratio },
            tx,
          });
        }
      }

      await tx.sprint.updateMany({
        where: { id: sprint.id, tenantId },
        data: {
          status: "ACTIVE",
          overcommitmentOverride: input.overcommitmentOverride ?? false,
          overcommitmentJustification: input.overcommitmentJustification,
        },
      });

      revalidatePath("/");
      return { id: sprint.id };
    });
  });
}

// ─── closeSprint ─────────────────────────────────────────────────────────────

const closeSprintSchema = z.object({
  sprintId: z.string().min(1),
});

export async function closeSprint(
  raw: unknown
): Promise<Result<{ velocity: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = closeSprintSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const sprint = await tx.sprint.findFirstOrThrow({
        where: { id: input.sprintId, tenantId },
        select: { id: true, teamId: true, status: true },
      });

      if (sprint.status !== "ACTIVE") {
        throw new Error(
          `INVALID_TRANSITION: sprint is ${sprint.status}, expected ACTIVE`
        );
      }

      // Compute velocity from DONE stories
      const done = await tx.story.aggregate({
        where: { sprintId: sprint.id, tenantId, status: "DONE" },
        _sum: { storyPoints: true },
      });
      const velocity = done._sum.storyPoints ?? 0;

      // AC-007: VELOCITY_DROP anomaly
      const history = await tx.sprint.findMany({
        where: { teamId: sprint.teamId, tenantId, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        take: 5,
        select: { velocity: true },
      });

      if (history.length >= MIN_VELOCITY_HISTORY) {
        const velocities = history
          .map((s) => s.velocity ?? 0)
          .filter((v) => v > 0);
        if (velocities.length >= MIN_VELOCITY_HISTORY) {
          const { mean, stdDev } = velocityStats(velocities);
          const threshold = mean - VELOCITY_SIGMA_MULTIPLIER * stdDev;
          if (velocity < threshold) {
            await createSprintAnomaly({
              tenantId,
              scopeId: sprint.teamId,
              rule: "VELOCITY_DROP",
              severity: "HIGH",
              metric: "velocity",
              delta: velocity - mean,
              metadata: { sprintId: sprint.id, velocity, mean, stdDev },
              tx,
            });
          }
        }
      }

      await tx.sprint.updateMany({
        where: { id: sprint.id, tenantId },
        data: { status: "CLOSED", velocity, closedAt: new Date() },
      });

      revalidatePath("/");
      return { velocity };
    });
  });
}

// ─── moveStoryOnBoard ────────────────────────────────────────────────────────

const BOARD_COLUMNS = new Set(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);

const moveStorySchema = z.object({
  storyId: z.string().min(1),
  toColumn: z.string().refine((c) => BOARD_COLUMNS.has(c), {
    message: "Invalid column",
  }),
});

export async function moveStoryOnBoard(
  raw: unknown
): Promise<Result<{ storyId: string }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = moveStorySchema.parse(raw);

    return database.$transaction(async (tx) => {
      const story = await tx.story.findFirstOrThrow({
        where: { id: input.storyId, tenantId },
        select: { id: true, status: true },
      });

      await tx.story.updateMany({
        where: { id: story.id, tenantId },
        data: {
          status: input.toColumn,
          startedAt: input.toColumn === "IN_PROGRESS" ? new Date() : undefined,
          completedAt: input.toColumn === "DONE" ? new Date() : undefined,
        },
      });

      await tx.stateTransitionHistory.create({
        data: {
          tenantId,
          entityType: "Story",
          entityId: story.id,
          fromStatus: story.status,
          toStatus: input.toColumn,
          userId,
        },
      });

      revalidatePath("/");
      return { storyId: story.id };
    });
  });
}

// ─── submitStandup ───────────────────────────────────────────────────────────

const submitStandupSchema = z.object({
  teamId: z.string().min(1),
  yesterday: z.string().optional(),
  today: z.string().optional(),
  blockers: z.string().optional(),
});

export async function submitStandup(
  raw: unknown
): Promise<Result<{ id: string; linkedImpedimentId: string | null }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = submitStandupSchema.parse(raw);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // AC-005: pgvector blocker → impediment match
    let linkedImpedimentId: string | null = null;
    if (input.blockers) {
      // Attempt vector similarity match against open impediments
      const matches = await database.$queryRaw<
        Array<{ id: string; similarity: number }>
      >`
        SELECT i.id, 1 - (kv.embedding <=> (
          SELECT embedding FROM "PIKnowledgeVector"
          WHERE entity_type = 'STANDUP_BLOCKER'
          ORDER BY created_at DESC LIMIT 1
        )) as similarity
        FROM "Impediment" i
        JOIN "PIKnowledgeVector" kv ON kv.entity_id = i.id AND kv.entity_type = 'IMPEDIMENT'
        WHERE i."tenantId" = ${tenantId}
          AND i."teamId" = ${input.teamId}
          AND i.status != 'RESOLVED'
          AND 1 - (kv.embedding <=> (
            SELECT embedding FROM "PIKnowledgeVector"
            WHERE entity_type = 'STANDUP_BLOCKER'
            ORDER BY created_at DESC LIMIT 1
          )) >= 0.8
        ORDER BY similarity DESC
        LIMIT 1
      `;
      if (matches.length > 0) {
        linkedImpedimentId = matches[0].id;
      }
    }

    const entry = await database.standupEntry.create({
      data: {
        tenantId,
        teamId: input.teamId,
        userId,
        date: today,
        yesterday: input.yesterday,
        today: input.today,
        blockers: input.blockers,
        linkedImpedimentId,
      },
      select: { id: true },
    });

    revalidatePath("/");
    return { id: entry.id, linkedImpedimentId };
  });
}

// ─── getSilentMembers ────────────────────────────────────────────────────────

type SilentMember = { userId: string; lastEntryDate: Date | null };

const getSilentMembersSchema = z.object({
  sprintId: z.string().min(1),
  teamId: z.string().min(1),
  sinceDate: z.string().datetime(),
});

export async function getSilentMembers(
  raw: unknown
): Promise<Result<{ silentMembers: SilentMember[] }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getSilentMembersSchema.parse(raw);

    const since = new Date(input.sinceDate);

    // Members assigned to this sprint
    const sprintMembers = await database.teamMemberAssignment.findMany({
      where: { sprintId: input.sprintId, teamId: input.teamId, tenantId },
      select: { userId: true },
    });

    const entriesSince = await database.standupEntry.findMany({
      where: {
        teamId: input.teamId,
        tenantId,
        date: { gte: since },
      },
      select: { userId: true, date: true },
      orderBy: { date: "desc" },
    });

    const lastEntryMap = new Map<string, Date>();
    for (const e of entriesSince) {
      if (!lastEntryMap.has(e.userId)) {
        lastEntryMap.set(e.userId, e.date);
      }
    }

    const silentMembers: SilentMember[] = sprintMembers
      .filter((m) => !lastEntryMap.has(m.userId))
      .map((m) => ({ userId: m.userId, lastEntryDate: null }));

    return { silentMembers };
  });
}

// ─── checkEstimationDrift ────────────────────────────────────────────────────

const checkEstimationDriftSchema = z.object({
  sprintId: z.string().min(1),
  originalPoints: z.number().int().positive(),
});

export async function checkEstimationDrift(
  raw: unknown
): Promise<Result<{ drifted: boolean; driftPercent: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = checkEstimationDriftSchema.parse(raw);

    const sprint = await database.sprint.findFirstOrThrow({
      where: { id: input.sprintId, tenantId },
      select: { id: true, teamId: true, status: true },
    });

    if (sprint.status !== "ACTIVE") {
      throw new Error("SPRINT_NOT_ACTIVE");
    }

    const current = await database.story.aggregate({
      where: { sprintId: sprint.id, tenantId },
      _sum: { storyPoints: true },
    });
    const currentPoints = current._sum.storyPoints ?? 0;
    const ratio = currentPoints / input.originalPoints;
    const drifted = ratio > ESTIMATION_DRIFT_THRESHOLD;

    if (drifted) {
      await database.$transaction(async (tx) => {
        await createSprintAnomaly({
          tenantId,
          scopeId: sprint.teamId,
          rule: "ESTIMATION_DRIFT",
          severity: "MEDIUM",
          metric: "sprint_points",
          delta: ratio - 1,
          metadata: {
            sprintId: sprint.id,
            originalPoints: input.originalPoints,
            currentPoints,
          },
          tx,
        });
      });
    }

    revalidatePath("/");
    return { drifted, driftPercent: Math.round((ratio - 1) * 100) };
  });
}
