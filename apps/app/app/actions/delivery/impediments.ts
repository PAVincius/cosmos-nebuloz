"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const MIN_RESOLUTION_NOTE_LENGTH = 20;

type Tx = Parameters<Parameters<typeof database.$transaction>[0]>[0];

async function createImpedimentAnomaly(opts: {
  tenantId: string;
  impedimentId: string;
  rule: string;
  ageHours: number;
  scopeId: string;
  tx: Tx;
}): Promise<void> {
  const run = await opts.tx.anomalyDetectionRun.create({
    data: {
      tenantId: opts.tenantId,
      scope: "team",
      scopeId: opts.scopeId,
      snapshotId: "impediment_aging",
      trigger: "aging_cron",
      status: "COMPLETED",
    },
    select: { id: true },
  });
  await opts.tx.anomaly.create({
    data: {
      tenantId: opts.tenantId,
      runId: run.id,
      rule: opts.rule,
      severity: "HIGH",
      metric: "impediment_age_hours",
      delta: opts.ageHours,
      metadata: { impedimentId: opts.impedimentId },
    },
  });
}

// ─── escalateImpediment ───────────────────────────────────────────────────────

const escalateImpedimentSchema = z.object({
  impedimentId: z.string().min(1),
  piPlanId: z.string().min(1),
  ownerUserId: z.string().optional(),
  dueDate: z.string().datetime(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export async function escalateImpediment(
  raw: unknown
): Promise<Result<{ riskId: string }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = escalateImpedimentSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const impediment = await tx.impediment.findFirstOrThrow({
        where: { id: input.impedimentId, tenantId },
        select: {
          id: true,
          title: true,
          description: true,
          artId: true,
          status: true,
        },
      });

      // AC-004: create Risk with category=IMPEDIMENT, roamStatus=OWNED
      const risk = await tx.risk.create({
        data: {
          tenantId,
          piPlanId: input.piPlanId,
          title: input.title ?? impediment.title,
          description: input.description ?? impediment.description,
          category: "IMPEDIMENT",
          roamStatus: "OWNED",
          ownerUserId: input.ownerUserId ?? userId,
          ownedAt: new Date(),
          dueDate: new Date(input.dueDate),
          source: "MANUAL",
          // bidirectional: impediment link on Risk
          impedimentId: input.impedimentId,
        },
        select: { id: true },
      });

      // bidirectional: linkedRiskId on Impediment
      await tx.impediment.updateMany({
        where: { id: impediment.id, tenantId },
        data: {
          status: "ESCALATED",
          linkedRiskId: risk.id,
        },
      });

      revalidatePath("/");
      return { riskId: risk.id };
    });
  });
}

// ─── resolveImpediment ────────────────────────────────────────────────────────

const resolveImpedimentSchema = z.object({
  impedimentId: z.string().min(1),
  resolutionNote: z.string().min(1),
});

export async function resolveImpediment(
  raw: unknown
): Promise<Result<{ resolutionTimeHours: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = resolveImpedimentSchema.parse(raw);

    // AC-005: note must be >= 20 chars
    if (input.resolutionNote.length < MIN_RESOLUTION_NOTE_LENGTH) {
      throw new Error(
        `RESOLUTION_NOTE_TOO_SHORT: minLength=${MIN_RESOLUTION_NOTE_LENGTH}, actual=${input.resolutionNote.length}`
      );
    }

    const impediment = await database.impediment.findFirstOrThrow({
      where: { id: input.impedimentId, tenantId },
      select: { id: true, status: true, createdAt: true },
    });

    const now = new Date();
    const resolutionTimeHours =
      (now.getTime() - impediment.createdAt.getTime()) / (60 * 60 * 1000);

    const count = await database.impediment
      .updateMany({
        where: { id: impediment.id, tenantId },
        data: {
          status: "RESOLVED",
          resolutionNote: input.resolutionNote,
          resolutionTime: resolutionTimeHours,
          resolvedAt: now,
        },
      })
      .then((r) => r.count);

    if (count === 0) {
      throw new Error("IMPEDIMENT_NOT_FOUND");
    }

    revalidatePath("/");
    return { resolutionTimeHours };
  });
}

// ─── checkImpedimentAging ─────────────────────────────────────────────────────

const CRITICAL_AGING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h

const checkImpedimentAgingSchema = z.object({
  impedimentId: z.string().min(1),
});

export async function checkImpedimentAging(
  raw: unknown
): Promise<Result<{ anomalyCreated: boolean }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = checkImpedimentAgingSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const impediment = await tx.impediment.findFirstOrThrow({
        where: { id: input.impedimentId, tenantId },
        select: {
          id: true,
          severity: true,
          status: true,
          createdAt: true,
          teamId: true,
        },
      });

      if (impediment.status === "RESOLVED") {
        return { anomalyCreated: false };
      }

      const ageMs = Date.now() - impediment.createdAt.getTime();
      const isCritical = impediment.severity <= 1;
      const exceeds24h = ageMs > CRITICAL_AGING_THRESHOLD_MS;

      if (!(isCritical && exceeds24h)) {
        return { anomalyCreated: false };
      }

      await createImpedimentAnomaly({
        tenantId,
        impedimentId: impediment.id,
        rule: "IMPEDIMENT_AGING",
        ageHours: ageMs / (60 * 60 * 1000),
        scopeId: impediment.teamId ?? tenantId,
        tx,
      });

      return { anomalyCreated: true };
    });
  });
}
