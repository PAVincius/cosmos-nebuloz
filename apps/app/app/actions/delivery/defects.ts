"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const SEVERITY_LEVELS = ["low", "medium", "high", "critical"] as const;
const SEVERITY_DOWNGRADE_ROLES = new Set(["ADMIN", "SM", "PO"]);

type Tx = Parameters<Parameters<typeof database.$transaction>[0]>[0];

async function createDefectAnomaly(opts: {
  tenantId: string;
  teamId: string;
  defectId: string;
  defectTitle: string;
  tx: Tx;
}): Promise<void> {
  const run = await opts.tx.anomalyDetectionRun.create({
    data: {
      tenantId: opts.tenantId,
      scope: "team",
      scopeId: opts.teamId,
      snapshotId: "defect_lifecycle",
      trigger: "defect_lifecycle",
      status: "COMPLETED",
    },
    select: { id: true },
  });
  await opts.tx.anomaly.create({
    data: {
      tenantId: opts.tenantId,
      runId: run.id,
      rule: "CRITICAL_DEFECT",
      severity: "CRITICAL",
      metric: "defect_severity",
      delta: 1,
      metadata: { defectId: opts.defectId, title: opts.defectTitle },
    },
  });
}

// ─── createDefect ─────────────────────────────────────────────────────────────

const createDefectSchema = z.object({
  sprintId: z.string().min(1),
  teamId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum(SEVERITY_LEVELS),
  storyId: z.string().optional(),
  assigneeUserId: z.string().optional(),
});

export async function createDefect(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = createDefectSchema.parse(raw);

    // Cross-tenant IDOR guard — the parent ids come from the client and none of
    // them carry a database FK, so nothing but this check keeps a defect from
    // pointing at another tenant's sprint, team or story.
    const [team, sprint, story, assignee] = await Promise.all([
      database.team.findFirst({
        where: { id: input.teamId, tenantId },
        select: { id: true },
      }),
      database.sprint.findFirst({
        where: { id: input.sprintId, tenantId },
        select: { id: true },
      }),
      input.storyId
        ? database.story.findFirst({
            where: { id: input.storyId, tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.assigneeUserId
        ? database.tenantMember.findFirst({
            where: { userId: input.assigneeUserId, tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!team) {
      throw new Error("TEAM_NOT_FOUND");
    }
    if (!sprint) {
      throw new Error("SPRINT_NOT_FOUND");
    }
    if (input.storyId && !story) {
      throw new Error("STORY_NOT_FOUND");
    }
    if (input.assigneeUserId && !assignee) {
      throw new Error("ASSIGNEE_NOT_IN_TENANT");
    }

    return database.$transaction(async (tx) => {
      const defect = await tx.defect.create({
        data: {
          tenantId,
          teamId: input.teamId,
          sprintId: input.sprintId,
          title: input.title,
          description: input.description,
          severity: input.severity,
          storyId: input.storyId,
          assigneeUserId: input.assigneeUserId,
          originSprintId: input.sprintId,
        },
        select: { id: true },
      });

      // AC-001: CRITICAL → CRITICAL_DEFECT anomaly in same transaction
      if (input.severity === "critical") {
        await createDefectAnomaly({
          tenantId,
          teamId: input.teamId,
          defectId: defect.id,
          defectTitle: input.title,
          tx,
        });
      }

      revalidatePath("/");
      return { id: defect.id };
    });
  });
}

// ─── updateDefectSeverity ─────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const updateDefectSeveritySchema = z.object({
  defectId: z.string().min(1),
  severity: z.enum(SEVERITY_LEVELS),
});

export async function updateDefectSeverity(
  raw: unknown
): Promise<Result<{ severity: string }>> {
  return safeAction(async () => {
    const { tenantId, role } = await requireTenantSession(await headers());
    const input = updateDefectSeveritySchema.parse(raw);

    const defect = await database.defect.findFirstOrThrow({
      where: { id: input.defectId, tenantId },
      select: { id: true, severity: true },
    });

    const isDowngrade =
      SEVERITY_ORDER[input.severity] < SEVERITY_ORDER[defect.severity];

    // AC-002: only SM/PO can downgrade
    if (isDowngrade && !SEVERITY_DOWNGRADE_ROLES.has(role)) {
      throw new Error(
        "INSUFFICIENT_ROLE: Only SM or PO can downgrade defect severity"
      );
    }

    await database.defect.updateMany({
      where: { id: input.defectId, tenantId },
      data: { severity: input.severity },
    });

    revalidatePath("/");
    return { severity: input.severity };
  });
}

// ─── reopenDefect ─────────────────────────────────────────────────────────────

const reopenDefectSchema = z.object({
  defectId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export async function reopenDefect(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = reopenDefectSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const defect = await tx.defect.findFirstOrThrow({
        where: { id: input.defectId, tenantId },
        select: { id: true, status: true, originSprintId: true },
      });

      if (defect.status !== "CLOSED") {
        throw new Error(
          `INVALID_TRANSITION: defect is ${defect.status}, expected CLOSED`
        );
      }

      await tx.defect.updateMany({
        where: { id: defect.id, tenantId },
        data: {
          status: "OPEN",
          reopenReason: input.reason,
          resolvedAt: null,
          // AC-003: originSprintId preserved — not updated on reopen
        },
      });

      await tx.stateTransitionHistory.create({
        data: {
          tenantId,
          entityType: "Defect",
          entityId: defect.id,
          fromStatus: "CLOSED",
          toStatus: "OPEN",
          userId,
          reason: input.reason,
        },
      });

      revalidatePath("/");
      return { id: defect.id };
    });
  });
}

// ─── checkDefectStaleness ─────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

const checkDefectStalenessSchema = z.object({
  defectId: z.string().min(1),
});

export async function checkDefectStaleness(
  raw: unknown
): Promise<Result<{ isStale: boolean }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = checkDefectStalenessSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const defect = await tx.defect.findFirstOrThrow({
        where: { id: input.defectId, tenantId },
        select: {
          id: true,
          severity: true,
          status: true,
          isStale: true,
          createdAt: true,
          teamId: true,
        },
      });

      if (
        defect.status === "CLOSED" ||
        defect.status === "IN_PROGRESS" ||
        defect.isStale
      ) {
        return { isStale: defect.isStale };
      }

      const ageMs = Date.now() - defect.createdAt.getTime();
      const isStale = defect.severity === "high" && ageMs > STALE_THRESHOLD_MS;

      if (isStale) {
        await tx.defect.updateMany({
          where: { id: defect.id, tenantId },
          data: { isStale: true, staleAt: new Date() },
        });

        const run = await tx.anomalyDetectionRun.create({
          data: {
            tenantId,
            scope: "team",
            scopeId: defect.teamId ?? tenantId,
            snapshotId: "defect_staleness",
            trigger: "staleness_cron",
            status: "COMPLETED",
          },
          select: { id: true },
        });
        await tx.anomaly.create({
          data: {
            tenantId,
            runId: run.id,
            rule: "STALE_DEFECT",
            severity: "LOW",
            metric: "defect_age_hours",
            delta: ageMs / (60 * 60 * 1000),
            metadata: { defectId: defect.id },
          },
        });
      }

      return { isStale };
    });
  });
}
