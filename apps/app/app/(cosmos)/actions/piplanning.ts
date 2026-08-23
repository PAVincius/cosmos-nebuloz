"use server";

// piplanning.ts — getActivePiPlanning(): active PI's objectives, ROAM risks,
// and latest confidence-vote average, all tenant-scoped.

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { applyVoteEvent, canSendVoteEvent } from "@repo/safe-engine";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { contarParticipantesDoPi } from "@/lib/pi/participantes";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

// Rodada de confidence vote do ART (story-060). É do ART, não por time:
// ConfidenceVoteTally é uma linha de contagens por rodada, com
// @@unique([voteSessionId, round]) e nenhuma coluna ligando voto a votante —
// um teamId quebraria a unicidade da rodada e o anonimato ao mesmo tempo.
export type ConfidenceVoteView = {
  round: number;
  status: string;
  totalVotes: number;
  participantCount: number;
  revealed: boolean;
  // Distribuição e placar só existem depois da revelação: resultado parcial
  // visível muda o voto de quem ainda não votou (story-018 AC-003).
  histogram: number[] | null;
  aggregateScore: number | null;
};

export type PiPlanningView = {
  piPlanId: string;
  piPlanName: string;
  // Status do PI (PLANNING/COMMITTED/EXECUTING): a tela precisa dele para saber
  // qual passo da cerimônia oferecer — comprometer, iniciar execução, ou nada.
  piPlanStatus: string;
  // Limite de confiança do ART. Vem junto porque a tela explica ao facilitador
  // por que o commit foi recusado, e "abaixo de 3" só faz sentido com o 3 à
  // vista.
  confidenceThreshold: number;
  // Current in-progress sprint under this PI (Sprint.status === "ACTIVE"),
  // null when no team has an active sprint right now.
  activeSprintName: string | null;
  objectives: {
    id: string;
    title: string;
    businessValue: number;
    status: string;
    isStretch: boolean;
    plannedValue: number;
    achievedValue: number;
    teamId: string | null;
    teamName: string | null;
  }[];
  risks: { id: string; title: string; roamStatus: string }[];
  confidenceAvg: number | null;
  confidenceVote: ConfidenceVoteView | null;
};

const TALLY_SELECT = {
  id: true,
  round: true,
  score1Count: true,
  score2Count: true,
  score3Count: true,
  score4Count: true,
  score5Count: true,
  totalVotes: true,
  participantCount: true,
  aggregateScore: true,
  revealedAt: true,
} as const;

function histogramOf(t: {
  score1Count: number;
  score2Count: number;
  score3Count: number;
  score4Count: number;
  score5Count: number;
}): number[] {
  return [
    t.score1Count,
    t.score2Count,
    t.score3Count,
    t.score4Count,
    t.score5Count,
  ];
}

// PI aberto do tenant — a mesma janela de status que a leitura usa. As escritas
// do voto localizam a rodada por aqui, nunca por id vindo do cliente: o voto é
// da cerimônia em curso, e não há id de rodada para o cliente escolher.
async function findActivePiPlanId(tenantId: string): Promise<string | null> {
  const plan = await database.pIPlan.findFirst({
    where: {
      tenantId,
      status: { in: ["PLANNING", "COMMITTED", "EXECUTING"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return plan?.id ?? null;
}

async function findCurrentVoteRound(tenantId: string, piPlanId: string) {
  return database.confidenceVoteSession.findFirst({
    where: { tenantId, piSession: { piPlanId } },
    orderBy: { roundNumber: "desc" },
    select: { id: true, roundNumber: true, xStateStatus: true },
  });
}

async function findOpenTally(tenantId: string, voteSessionId: string) {
  return database.confidenceVoteTally.findFirst({
    where: { tenantId, voteSessionId, closedAt: null },
    orderBy: { round: "desc" },
    select: TALLY_SELECT,
  });
}

export async function getActivePiPlanning(): Promise<
  Result<PiPlanningView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const plan = await database.pIPlan.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ["PLANNING", "COMMITTED", "EXECUTING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        confidenceThreshold: true,
        piObjectives: {
          select: {
            id: true,
            title: true,
            businessValue: true,
            status: true,
            isStretch: true,
            plannedValue: true,
            achievedValue: true,
            teamId: true,
          },
        },
        risks: { select: { id: true, title: true, roamStatus: true } },
        sprints: {
          where: { tenantId: ctx.tenantId, status: "ACTIVE" },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { name: true },
        },
      },
    });
    if (!plan) {
      return null;
    }

    const round = await findCurrentVoteRound(ctx.tenantId, plan.id);
    const tally = round
      ? await database.confidenceVoteTally.findFirst({
          where: { tenantId: ctx.tenantId, voteSessionId: round.id },
          orderBy: { round: "desc" },
          select: TALLY_SELECT,
        })
      : null;
    const revealed = !!tally?.revealedAt;
    const confidenceVote: ConfidenceVoteView | null = round
      ? {
          round: tally?.round ?? round.roundNumber,
          status: round.xStateStatus,
          totalVotes: tally?.totalVotes ?? 0,
          participantCount: tally?.participantCount ?? 0,
          revealed,
          histogram: revealed && tally ? histogramOf(tally) : null,
          aggregateScore: revealed ? (tally?.aggregateScore ?? null) : null,
        }
      : null;

    const teamIds = [
      ...new Set(
        plan.piObjectives
          .map((o) => o.teamId)
          .filter((id): id is string => !!id)
      ),
    ];
    const teams = teamIds.length
      ? await database.team.findMany({
          where: { id: { in: teamIds }, tenantId: ctx.tenantId },
          select: { id: true, name: true },
        })
      : [];
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    return {
      piPlanId: plan.id,
      piPlanName: plan.name,
      piPlanStatus: plan.status,
      confidenceThreshold: plan.confidenceThreshold,
      activeSprintName: plan.sprints[0]?.name ?? null,
      objectives: plan.piObjectives.map((o) => ({
        id: o.id,
        title: o.title,
        businessValue: o.businessValue,
        status: o.status,
        isStretch: o.isStretch,
        plannedValue: o.plannedValue,
        achievedValue: o.achievedValue,
        teamId: o.teamId,
        teamName: (o.teamId && teamNameById.get(o.teamId)) || null,
      })),
      risks: plan.risks,
      // O KPI não pode antecipar o placar de uma rodada ainda não revelada.
      confidenceAvg: confidenceVote?.aggregateScore ?? null,
      confidenceVote,
    };
  });
}

// ── Confidence vote: caminho de escrita (story-060) ──────────────────────────

const CastVoteSchema = z.object({
  score: z.number().int().min(1).max(5),
});

/**
 * Abre a rodada de confidence vote do PI ativo — o passo que faltava.
 *
 * A cerimônia depende de três linhas encadeadas: a `PISession` (a cerimônia),
 * a `ConfidenceVoteSession` (a rodada, com sua máquina de estado) e o
 * `ConfidenceVoteTally` (o placar anônimo onde os votos caem). As três já
 * existiam no banco e nenhuma tela as criava: o card de voto só sabia dizer
 * "nenhuma rodada aberta", e não havia caminho no produto para abrir uma.
 *
 * Tudo numa transação porque o estado meio-criado é o pior dos mundos: uma
 * rodada `OPEN` sem placar aceita o clique do votante e depois recusa o voto
 * com "nenhuma rodada aberta para receber voto" — mensagem que acusa o
 * contrário do que aconteceu.
 *
 * Idempotente: com rodada aberta e placar aberto, devolve o que existe em vez
 * de empilhar uma rodada por clique.
 */
export async function abrirRodadaDeConfianca(): Promise<
  Result<{ round: number; participantCount: number; jaAberta: boolean }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    // Mesmo gate de facilitador que revelar: abrir e revelar são os dois atos
    // de condução da cerimônia. Votar, não — votar é de todo mundo.
    requireRole(["ADMIN", "RTE"], ctx);

    const piPlanId = await findActivePiPlanId(ctx.tenantId);
    if (!piPlanId) {
      throw new Error("Nenhum PI aberto para planejamento.");
    }

    const participantCount = await contarParticipantesDoPi(database, {
      piPlanId,
      tenantId: ctx.tenantId,
    });
    if (participantCount === 0) {
      throw new Error(
        "Nenhuma pessoa neste workspace para compor o quórum da votação."
      );
    }

    const atual = await findCurrentVoteRound(ctx.tenantId, piPlanId);
    if (atual) {
      const placarAberto = await findOpenTally(ctx.tenantId, atual.id);
      if (placarAberto && atual.xStateStatus === "OPEN") {
        return {
          round: placarAberto.round,
          participantCount: placarAberto.participantCount,
          jaAberta: true,
        };
      }
    }

    const piSession =
      (await database.pISession.findFirst({
        where: { piPlanId, tenantId: ctx.tenantId, type: "PLANNING" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await database.pISession.create({
        data: { tenantId: ctx.tenantId, piPlanId, type: "PLANNING" },
        select: { id: true },
      }));

    // Uma rodada em `NOT_STARTED` ou `OPEN` ainda é a rodada corrente e volta a
    // receber votos; qualquer outro estado (TALLYING, REWORK, APPROVED) já teve
    // seu desfecho, e abrir votação depois disso é abrir a rodada seguinte.
    const reaproveita =
      atual &&
      (atual.xStateStatus === "OPEN" || atual.xStateStatus === "NOT_STARTED");
    const roundNumber = reaproveita
      ? atual.roundNumber
      : (atual?.roundNumber ?? 0) + 1;

    const { round } = await database.$transaction(async (tx) => {
      const voteSessionId = reaproveita
        ? atual.id
        : (
            await tx.confidenceVoteSession.create({
              data: {
                tenantId: ctx.tenantId,
                piSessionId: piSession.id,
                roundNumber,
                xStateStatus: "NOT_STARTED",
                votes: [],
              },
              select: { id: true },
            })
          ).id;

      // Quem decide que NOT_STARTED → OPEN é legal é a máquina do
      // @repo/safe-engine, a mesma que guarda o voto e a revelação. Abrir por
      // escrita direta faria a tela e a máquina discordarem sobre a rodada.
      const aberta = applyVoteEvent(
        { xStateStatus: "NOT_STARTED", votes: [] },
        { type: "START_VOTING" }
      );
      if (!aberta) {
        throw new Error("A máquina de votação recusou abrir a rodada.");
      }
      await tx.confidenceVoteSession.update({
        where: { id: voteSessionId },
        data: { xStateStatus: aberta.xStateStatus },
      });

      // O número do placar segue o último placar desta rodada, não o número da
      // rodada: `@@unique([voteSessionId, round])` proíbe repetir, e uma sessão
      // reaproveitada pode já carregar um placar fechado de antes.
      const ultimoPlacar = await tx.confidenceVoteTally.findFirst({
        where: { voteSessionId, tenantId: ctx.tenantId },
        orderBy: { round: "desc" },
        select: { round: true },
      });
      const placar = await tx.confidenceVoteTally.create({
        data: {
          tenantId: ctx.tenantId,
          voteSessionId,
          piPlanId,
          round: ultimoPlacar ? ultimoPlacar.round + 1 : roundNumber,
          participantCount,
        },
        select: { id: true, round: true },
      });
      return { round: placar.round, tallyId: placar.id };
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "confidence_vote",
      entityId: piPlanId,
      diff: { round: String(round), participantes: String(participantCount) },
    });
    revalidateTag(`piplanning:${ctx.tenantId}`, "max");
    return { round, participantCount, jaAberta: false };
  });
}

const MIN_PARTICIPATION_PCT = 50;

export async function castConfidenceVote(
  input: z.infer<typeof CastVoteSchema>
): Promise<Result<{ round: number; totalVotes: number }>> {
  return safeAction(async () => {
    // Sem requireRole: todo participante da cerimônia vota — é o ponto do
    // fist-of-five. O gate de papel existe só para revelar o resultado.
    const ctx = await requireTenantSession(await headers());
    const { score } = CastVoteSchema.parse(input);

    const piPlanId = await findActivePiPlanId(ctx.tenantId);
    if (!piPlanId) {
      throw new Error("Nenhum PI ativo para votar.");
    }

    const round = await findCurrentVoteRound(ctx.tenantId, piPlanId);
    if (!round) {
      throw new Error("Nenhuma rodada de confidence vote nesta PI.");
    }

    // Quem decide se SUBMIT_VOTE é legal neste estado é a máquina do
    // @repo/safe-engine — o console de ART usa a mesma, então as duas telas não
    // podem discordar sobre a mesma rodada. `votes` não participa do guard (a
    // contagem por nota mora no tally da story-018), só da assinatura.
    const legal = canSendVoteEvent(
      { xStateStatus: round.xStateStatus, votes: [] },
      { type: "SUBMIT_VOTE", vote: score }
    );
    if (!legal) {
      throw new Error(
        `A rodada não está aberta para voto (estado: ${round.xStateStatus}).`
      );
    }

    const tally = await findOpenTally(ctx.tenantId, round.id);
    if (!tally) {
      throw new Error("Nenhuma rodada aberta para receber voto.");
    }

    // Incremento atômico e anônimo: nada além da contagem da nota é escrito.
    // Nenhum logAudit aqui — auditar o voto guardaria ator e carimbo de tempo,
    // que é exatamente o vínculo que a story-018 AC-002 proíbe.
    const scoreField = `score${score}Count` as const;
    const updated = await database.confidenceVoteTally.update({
      where: { id: tally.id },
      data: {
        [scoreField]: { increment: 1 },
        totalVotes: { increment: 1 },
      },
    });

    revalidateTag(`piplanning:${ctx.tenantId}`, "max");
    return { round: tally.round, totalVotes: updated.totalVotes };
  });
}

export async function revealTally(): Promise<
  Result<{
    round: number;
    aggregateScore: number;
    participationRate: number;
    histogram: number[];
  }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    // Mesmo gate de facilitador que app/actions/arts/tally-vote.ts aplica.
    requireRole(["ADMIN", "RTE"], ctx);

    const piPlanId = await findActivePiPlanId(ctx.tenantId);
    if (!piPlanId) {
      throw new Error("Nenhum PI ativo.");
    }

    const round = await findCurrentVoteRound(ctx.tenantId, piPlanId);
    if (!round) {
      throw new Error("Nenhuma rodada de confidence vote nesta PI.");
    }

    const next = applyVoteEvent(
      { xStateStatus: round.xStateStatus, votes: [] },
      { type: "CLOSE_VOTING" }
    );
    if (!next) {
      throw new Error(
        `Não é possível fechar a votação a partir de "${round.xStateStatus}".`
      );
    }

    const tally = await findOpenTally(ctx.tenantId, round.id);
    if (!tally) {
      throw new Error("Nenhuma rodada aberta para revelar.");
    }

    const participationRate =
      tally.participantCount > 0
        ? (tally.totalVotes / tally.participantCount) * 100
        : 0;
    if (participationRate < MIN_PARTICIPATION_PCT) {
      throw new Error(
        `Participação de ${Math.round(participationRate)}% abaixo do mínimo de ${MIN_PARTICIPATION_PCT}% para revelar o resultado.`
      );
    }

    const histogram = histogramOf(tally);
    const weightedSum = histogram.reduce(
      (sum, count, index) => sum + count * (index + 1),
      0
    );
    const aggregateScore =
      tally.totalVotes > 0 ? weightedSum / tally.totalVotes : 0;

    const now = new Date();
    await database.confidenceVoteTally.update({
      where: { id: tally.id },
      data: {
        aggregateScore,
        participationRate,
        revealedAt: now,
        closedAt: now,
      },
    });
    // Duas escritas em vez de uma transação: se esta falhar, o tally já está
    // fechado e a próxima tentativa de voto não encontra rodada aberta — o
    // estado degrada para "ninguém vota", nunca para contagem corrompida.
    await database.confidenceVoteSession.update({
      where: { id: round.id },
      data: { xStateStatus: next.xStateStatus, averageScore: aggregateScore },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "confidence_vote",
      entityId: tally.id,
      diff: {
        round: String(tally.round),
        aggregateScore: aggregateScore.toFixed(2),
        participationRate: `${Math.round(participationRate)}%`,
      },
    });
    revalidateTag(`piplanning:${ctx.tenantId}`, "max");
    return {
      round: tally.round,
      aggregateScore,
      participationRate,
      histogram,
    };
  });
}

// Count of ARTs currently running (ART.status === "ACTIVE"), tenant-scoped —
// backs the "N ARTs ativos" dashboard header badge and KPI hint.
export async function getActiveArtCount(): Promise<Result<number>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.aRT.count({
      where: { tenantId: ctx.tenantId, status: "ACTIVE" },
    });
  });
}

export type PiPredictabilityPoint = {
  id: string;
  label: string;
  ppmPct: number;
};

// Last closed PIs' Program Predictability Measure (PIPlan.ppm), oldest→newest —
// the real SAFe PI predictability trend, only defined once a PI is closed.
export async function listRecentPiPredictability(): Promise<
  Result<PiPredictabilityPoint[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.pIPlan.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "CLOSED",
        ppm: { not: null },
        // Postgres sorts NULLs first on DESC — a null endDate would hijack
        // the "most recent" slot ahead of genuinely newer PIs. A closed PI
        // without an endDate also has no well-defined position in a
        // "recent" trend, so exclude it rather than guess an ordering.
        endDate: { not: null },
      },
      orderBy: { endDate: "desc" },
      take: 6,
      select: { id: true, name: true, ppm: true },
    });
    return rows
      .map((p) => ({
        id: p.id,
        label: p.name,
        ppmPct: Math.round(p.ppm as number),
      }))
      .reverse();
  });
}
