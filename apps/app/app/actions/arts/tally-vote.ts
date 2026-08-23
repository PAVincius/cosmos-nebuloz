"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { contarParticipantesDoPi } from "@/lib/pi/participantes";
import { type Result, safeAction } from "../_base";

const MIN_PARTICIPATION_PCT = 50;
const MAX_ROUNDS_BEFORE_NOTE = 10;
const ALLOWED_FACILITATOR_ROLES = new Set(["ADMIN", "RTE"]);

const CastVoteSchema = z.object({
  voteSessionId: z.string().min(1),
  score: z.number().int().min(1).max(5),
});

const RevealSchema = z.object({
  tallyId: z.string().min(1),
});

const OpenNextRoundSchema = z.object({
  voteSessionId: z.string().min(1),
  facilitatorNote: z.string().max(2000).optional(),
});

export async function castAnonymousVote(
  raw: unknown
): Promise<Result<{ totalVotes: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CastVoteSchema.parse(raw);

    const scoreField = `score${input.score}Count` as
      | "score1Count"
      | "score2Count"
      | "score3Count"
      | "score4Count"
      | "score5Count";

    const tally = await database.confidenceVoteTally.findFirst({
      where: {
        voteSessionId: input.voteSessionId,
        tenantId: ctx.tenantId,
        closedAt: null,
      },
      orderBy: { round: "desc" },
    });

    if (!tally) {
      throw new Error("TALLY_NOT_FOUND");
    }
    if (tally.closedAt) {
      throw new Error("ROUND_CLOSED");
    }

    const updated = await database.confidenceVoteTally.update({
      where: { id: tally.id },
      data: {
        [scoreField]: { increment: 1 },
        totalVotes: { increment: 1 },
      },
      select: { totalVotes: true },
    });

    return { totalVotes: updated.totalVotes };
  });
}

export async function revealVoteResults(raw: unknown): Promise<
  Result<{
    aggregateScore: number;
    histogram: Record<string, number>;
    participationRate: number;
  }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_FACILITATOR_ROLES.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = RevealSchema.parse(raw);

    const tally = await database.confidenceVoteTally.findFirstOrThrow({
      where: { id: input.tallyId, tenantId: ctx.tenantId },
    });

    if (tally.closedAt) {
      throw new Error("ROUND_CLOSED");
    }

    const participationPct =
      tally.participantCount > 0
        ? (tally.totalVotes / tally.participantCount) * 100
        : 0;

    if (participationPct < MIN_PARTICIPATION_PCT) {
      throw new Error(
        `REVEAL_GATE_NOT_MET:${Math.round(participationPct)}:${MIN_PARTICIPATION_PCT}`
      );
    }

    const weightedSum =
      tally.score1Count * 1 +
      tally.score2Count * 2 +
      tally.score3Count * 3 +
      tally.score4Count * 4 +
      tally.score5Count * 5;

    const aggregateScore =
      tally.totalVotes > 0 ? weightedSum / tally.totalVotes : 0;

    await database.$transaction(async (tx) => {
      await tx.confidenceVoteTally.update({
        where: { id: input.tallyId },
        data: {
          aggregateScore,
          participationRate: participationPct,
          revealedAt: new Date(),
          closedAt: new Date(),
        },
      });

      await tx.confidenceVoteSession.update({
        where: { id: tally.voteSessionId },
        data: { averageScore: aggregateScore },
      });
    });

    revalidatePath("/arts");
    return {
      aggregateScore,
      participationRate: participationPct,
      histogram: {
        "1": tally.score1Count,
        "2": tally.score2Count,
        "3": tally.score3Count,
        "4": tally.score4Count,
        "5": tally.score5Count,
      },
    };
  });
}

export async function openNextVoteRound(
  raw: unknown
): Promise<Result<{ round: number; tallyId: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    if (!ALLOWED_FACILITATOR_ROLES.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const input = OpenNextRoundSchema.parse(raw);

    const latestTally = await database.confidenceVoteTally.findFirst({
      where: { voteSessionId: input.voteSessionId, tenantId: ctx.tenantId },
      orderBy: { round: "desc" },
    });

    const nextRound = latestTally ? latestTally.round + 1 : 1;

    if (latestTally && !latestTally.closedAt) {
      throw new Error("CURRENT_ROUND_NOT_CLOSED");
    }

    if (nextRound > MAX_ROUNDS_BEFORE_NOTE && !input.facilitatorNote) {
      throw new Error("FACILITATOR_NOTE_REQUIRED");
    }

    const voteSession = await database.confidenceVoteSession.findFirstOrThrow({
      where: { id: input.voteSessionId, tenantId: ctx.tenantId },
      include: {
        piSession: {
          include: { piPlan: { select: { id: true } } },
        },
      },
    });

    const piPlanId = voteSession.piSession.piPlan.id;

    // Mesma contagem que a abertura da primeira rodada usa: sem lista explícita
    // de participantes, uma rodada nasceria com quórum zero e nunca poderia ser
    // revelada. Ver lib/pi/participantes.ts.
    const participantCount = await contarParticipantesDoPi(database, {
      piPlanId,
      tenantId: ctx.tenantId,
    });

    const tally = await database.confidenceVoteTally.create({
      data: {
        tenantId: ctx.tenantId,
        voteSessionId: input.voteSessionId,
        piPlanId,
        round: nextRound,
        participantCount,
        ...(input.facilitatorNote && {
          facilitatorNote: input.facilitatorNote,
        }),
      },
      select: { id: true, round: true },
    });

    if (input.facilitatorNote) {
      await database.confidenceVoteSession.update({
        where: { id: input.voteSessionId },
        data: { facilitatorNote: input.facilitatorNote },
      });
    }

    revalidatePath("/arts");
    return { round: tally.round, tallyId: tally.id };
  });
}

export async function getConfidenceVoteHistory(artId: string) {
  const ctx = await requireTenantSession(await headers());

  const plans = await database.pIPlan.findMany({
    where: { artId, tenantId: ctx.tenantId, status: "CLOSED" },
    orderBy: { closedAt: "asc" },
    select: { id: true, name: true, closedAt: true },
  });

  const history = await Promise.all(
    plans.map(async (plan) => {
      const tally = await database.confidenceVoteTally.findFirst({
        where: { piPlanId: plan.id, tenantId: ctx.tenantId },
        orderBy: { round: "desc" },
        select: { aggregateScore: true, round: true },
      });
      return {
        piPlanId: plan.id,
        piPlanName: plan.name,
        closedAt: plan.closedAt,
        finalScore: tally?.aggregateScore ?? null,
        finalRound: tally?.round ?? null,
      };
    })
  );

  return history;
}
