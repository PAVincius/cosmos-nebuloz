"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
const ok = <T>(data: T): Ok<T> => ({ ok: true, data });

// INVARIANT: userId1 < userId2 always — enforced here before every write
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function computeSynergyScore({
  actualSp,
  predictedSp,
}: {
  actualSp: number;
  predictedSp: number;
}): number {
  if (predictedSp === 0) {
    return 0;
  }
  return ((actualSp - predictedSp) / predictedSp) * 100;
}

export async function updatePairSynergiesForTask(
  taskId: string,
  teamId: string
): Promise<Ok<{ pairsUpdated: number }> | Err> {
  const { tenantId } = await requireTenantSession(await headers());

  const [assignees, story] = await Promise.all([
    database.taskAssignee.findMany({
      where: { taskId },
      select: { userId: true },
    }),
    database.story.findFirst({
      where: { tenantId, tasks: { some: { id: taskId } } },
      select: { storyPoints: true, taskType: true },
    }),
  ]);

  if (assignees.length < 2) {
    return ok({ pairsUpdated: 0 });
  }

  const userIds = assignees.map((a) => a.userId);
  const actualSp = story?.storyPoints ?? 1;
  const taskType = (story as { taskType?: string | null })?.taskType ?? "any";

  const pairs: [string, string][] = [];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      pairs.push(canonicalPair(userIds[i], userIds[j]));
    }
  }

  let pairsUpdated = 0;
  for (const [u1, u2] of pairs) {
    const [b1, b2] = await Promise.all([
      database.memberThroughputBaseline.findFirst({
        where: { tenantId, teamId, userId: u1 },
        select: { p50Estimate: true },
      }),
      database.memberThroughputBaseline.findFirst({
        where: { tenantId, teamId, userId: u2 },
        select: { p50Estimate: true },
      }),
    ]);

    const predictedSp = (b1?.p50Estimate ?? 0) + (b2?.p50Estimate ?? 0);
    const newScore = computeSynergyScore({ actualSp, predictedSp });

    const existing = await database.pairSynergy.upsert({
      where: {
        tenantId_userId1_userId2_taskType: {
          tenantId,
          userId1: u1,
          userId2: u2,
          taskType,
        },
      },
      create: {
        tenantId,
        userId1: u1,
        userId2: u2,
        taskType,
        score: newScore,
        samples: 1,
        totalSp: actualSp,
        variance: 0,
        confidence: 1 / 8,
        firstTaskAt: new Date(),
        lastTaskAt: new Date(),
      },
      update: {},
      select: {
        id: true,
        samples: true,
        score: true,
        variance: true,
        totalSp: true,
      },
    });

    // Update running average if record already existed (samples > 1 after upsert means it existed)
    const n = existing.samples;
    if (n > 1) {
      // Welford online algorithm
      const newN = n + 1;
      const oldAvg = existing.score;
      const updatedAvg = (oldAvg * n + newScore) / newN;
      const delta = newScore - oldAvg;
      const updatedVariance =
        ((n - 1) * existing.variance + (n * delta * delta) / newN) / (newN - 1);

      await database.pairSynergy.update({
        where: {
          tenantId_userId1_userId2_taskType: {
            tenantId,
            userId1: u1,
            userId2: u2,
            taskType,
          },
        },
        data: {
          score: updatedAvg,
          samples: newN,
          totalSp: existing.totalSp + actualSp,
          variance: updatedVariance,
          confidence: Math.min(newN / 8, 1.0),
          lastTaskAt: new Date(),
        },
      });
    }

    pairsUpdated += 1;
  }

  return ok({ pairsUpdated });
}

export type SynergyPair = {
  userId1: string;
  userId2: string;
  score: number;
  confidence: number;
  samples: number;
  taskType: string;
  hasEnoughData: boolean;
};

export async function getSynergyMatrix(
  teamId: string,
  taskType = "any"
): Promise<Ok<{ pairs: SynergyPair[]; teamId: string }> | Err> {
  const { tenantId } = await requireTenantSession(await headers());

  const baselines = await database.memberThroughputBaseline.findMany({
    where: { tenantId, teamId },
    select: { userId: true },
  });

  const userIds = baselines.map((b) => b.userId);
  if (userIds.length < 2) {
    return ok({ pairs: [], teamId });
  }

  const pairs = await database.pairSynergy.findMany({
    where: {
      tenantId,
      taskType,
      OR: [{ userId1: { in: userIds } }, { userId2: { in: userIds } }],
    },
  });

  return ok({
    pairs: pairs.map((p) => ({
      userId1: p.userId1,
      userId2: p.userId2,
      score: p.score,
      confidence: p.confidence,
      samples: p.samples,
      taskType: p.taskType,
      hasEnoughData: p.confidence >= 0.5,
    })),
    teamId,
  });
}
