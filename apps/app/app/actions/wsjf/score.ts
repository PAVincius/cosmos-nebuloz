"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getWsjfSettings } from "../../(cosmos)/actions/wsjf";
import { type Result, safeAction } from "../_base";

const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 20]);
const SA_LOCK_ROLES = new Set(["ADMIN", "RTE", "STE"]);

const WsjfScoreSchema = z.object({
  featureId: z.string().min(1),
  bv: z.number().int().positive(),
  tc: z.number().int().positive(),
  rr: z.number().int().positive(),
  js: z.number().int().positive(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  justification: z.string().max(1000).optional(),
  source: z.enum(["MANUAL", "COPILOT"]).default("MANUAL"),
});

export type WsjfScoreInput = z.infer<typeof WsjfScoreSchema>;

const LockJobSizeSchema = z.object({
  featureId: z.string().min(1),
  lock: z.boolean(),
});

function findInvalidFibonacci(
  values: Record<string, number>
): { field: string } | null {
  for (const [field, val] of Object.entries(values)) {
    if (!FIBONACCI.has(val)) {
      return { field };
    }
  }
  return null;
}

async function recomputeNormalized(
  tenantId: string,
  piPlanId: string | null,
  updatedFeatureId: string
): Promise<number | null> {
  const where = piPlanId
    ? { tenantId, piPlanId, wsjfScore: { gt: 0 as number } }
    : { tenantId, wsjfScore: { gt: 0 as number } };

  const features = await database.feature.findMany({
    where,
    select: { id: true, wsjfScore: true },
  });

  if (features.length === 0) {
    return null;
  }

  const maxScore = Math.max(...features.map((f) => f.wsjfScore));
  if (maxScore === 0) {
    return null;
  }

  await database.$transaction(
    features.map((f) =>
      database.feature.update({
        where: { id: f.id },
        data: {
          wsjfNormalizedScore:
            Math.round((f.wsjfScore / maxScore) * 100 * 100) / 100,
        },
      })
    )
  );

  const updated = features.find((f) => f.id === updatedFeatureId);
  if (!updated) {
    return null;
  }
  return Math.round((updated.wsjfScore / maxScore) * 100 * 100) / 100;
}

export async function scoreWsjfAction(
  raw: unknown
): Promise<Result<{ wsjfScore: number; normalizedScore: number | null }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = WsjfScoreSchema.parse(raw);

    const invalid = findInvalidFibonacci({
      bv: input.bv,
      tc: input.tc,
      rr: input.rr,
      js: input.js,
    });
    if (invalid) {
      throw new Error(
        `INVALID_WSJF_VALUE:${invalid.field}:Must be a Modified Fibonacci value [1,2,3,5,8,13,20]`
      );
    }

    const feature = await database.feature.findFirstOrThrow({
      where: { id: input.featureId, tenantId: ctx.tenantId },
      select: {
        bv: true,
        tc: true,
        rr: true,
        js: true,
        wsjfScore: true,
        piPlanId: true,
        wsjfJobSizeLockedBy: true,
      },
    });

    if (feature.wsjfJobSizeLockedBy && feature.js !== input.js) {
      throw new Error(
        `WSJF_JOB_SIZE_LOCKED:Job size is locked by ${feature.wsjfJobSizeLockedBy}`
      );
    }

    // Tenant weight multipliers (Task 16, WsjfSettingsModal). Falls back to
    // the classic 1.0/1.0/1.0 weights — reproducing the pre-Task-16 formula
    // byte-for-byte — whenever no settings row exists or the lookup fails,
    // so scoring is never blocked by a settings-lookup hiccup.
    const settingsResult = await getWsjfSettings();
    const weights = settingsResult.ok
      ? settingsResult.data
      : { weightBv: 1, weightTc: 1, weightRr: 1 };

    const costOfDelay =
      input.bv * weights.weightBv +
      input.tc * weights.weightTc +
      input.rr * weights.weightRr;
    const wsjfScore = Math.round((costOfDelay / input.js) * 100) / 100;

    await database.$transaction(async (tx) => {
      await tx.feature.update({
        where: { id: input.featureId },
        data: {
          bv: input.bv,
          tc: input.tc,
          rr: input.rr,
          js: input.js,
          wsjfScore,
          wsjfCostOfDelay: costOfDelay,
          wsjfConfidence: input.confidence,
          wsjfScoredBy: ctx.userId,
          wsjfScoredAt: new Date(),
        },
      });

      await tx.scoringEvent.create({
        data: {
          tenantId: ctx.tenantId,
          featureId: input.featureId,
          prevBv: feature.bv,
          prevTc: feature.tc,
          prevRr: feature.rr,
          prevJs: feature.js,
          prevScore: feature.wsjfScore,
          bv: input.bv,
          tc: input.tc,
          rr: input.rr,
          js: input.js,
          wsjfScore,
          confidence: input.confidence,
          source: input.source,
          userId: ctx.userId,
          justification: input.justification,
        },
      });
    });

    const normalizedScore = await recomputeNormalized(
      ctx.tenantId,
      feature.piPlanId,
      input.featureId
    );

    revalidatePath("/portfolio");
    return { wsjfScore, normalizedScore };
  });
}

export async function lockJobSizeAction(
  raw: unknown
): Promise<Result<{ locked: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    if (!SA_LOCK_ROLES.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const { featureId, lock } = LockJobSizeSchema.parse(raw);

    await database.feature.updateMany({
      where: { id: featureId, tenantId: ctx.tenantId },
      data: {
        wsjfJobSizeLockedBy: lock ? ctx.userId : null,
        wsjfJobSizeLockedAt: lock ? new Date() : null,
      },
    });

    return { locked: lock };
  });
}

export async function getScoringHistory(featureId: string): Promise<
  Result<
    {
      id: string;
      prevBv: number | null;
      prevTc: number | null;
      prevRr: number | null;
      prevJs: number | null;
      prevScore: number | null;
      bv: number | null;
      tc: number | null;
      rr: number | null;
      js: number | null;
      wsjfScore: number | null;
      source: string;
      userId: string | null;
      createdAt: Date;
    }[]
  >
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    return database.scoringEvent.findMany({
      where: { featureId, tenantId: ctx.tenantId },
      select: {
        id: true,
        prevBv: true,
        prevTc: true,
        prevRr: true,
        prevJs: true,
        prevScore: true,
        bv: true,
        tc: true,
        rr: true,
        js: true,
        wsjfScore: true,
        source: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });
}
