import "server-only";

import type { MeridianAxis } from "@repo/database";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { type MeridianContext, MeridianRuleError } from "@/lib/meridian/guards";
import {
  computeAxisScore,
  type ScoringAnswer,
  type ScoringQuestion,
} from "@/lib/meridian/scoring";
import { contributeInTx } from "./_benchmark-core";
import { type Db, logMeridianAudit, nextCode } from "./_shared";

// Miolo do scoring: o que `runScoring` (aqui, em `scoring.ts`) e o fechamento de
// coleta (`collection.ts`) chamam por dentro, na transação deles. Fica FORA do
// arquivo `"use server"` de propósito: todo export assíncrono de um arquivo assim
// vira endpoint, e `runScoringInTx` recebe um cliente de transação e o contexto
// do ator. Não é uma ação (achado 7 do Vigia).

export type AxisScoreOut = {
  axis: MeridianAxis;
  computed: number;
  confidence: number;
  respondentCount: number;
  spread: number;
  status: string;
  note: string | null;
};

/**
 * Núcleo do scoring, reusável dentro de uma transação já aberta.
 *
 * Idempotente por construção: reescreve `MeridianAxisScore` por `upsert` e
 * deriva gap só quando ainda não existe gap derivado para aquele eixo. Rodar
 * duas vezes sobre as mesmas respostas produz o mesmo estado — que é o que
 * "determinístico" tem de significar também no efeito colateral, não só no
 * número.
 */
export async function runScoringInTx(
  db: Db,
  ctx: MeridianContext,
  assessmentId: string
): Promise<AxisScoreOut[]> {
  const a = await db.meridianAssessment.findFirst({
    where: { id: assessmentId, tenantId: ctx.tenantId },
    include: {
      template: {
        select: {
          contestedSpread: true,
          gapThreshold: true,
          questions: {
            orderBy: { ordinal: "asc" },
            select: {
              id: true,
              code: true,
              axis: true,
              ordinal: true,
              type: true,
              weight: true,
              inverted: true,
              scaleLabels: true,
            },
          },
        },
      },
      respondents: {
        where: { status: { not: "REVOKED" } },
        select: { id: true, axis: true },
      },
    },
  });
  if (!a) {
    throw new MeridianRuleError(
      "assessment.not-found",
      "Assessment não encontrado nesta organização."
    );
  }

  const responses = await db.meridianResponse.findMany({
    where: {
      tenantId: ctx.tenantId,
      respondentId: { in: a.respondents.map((r) => r.id) },
    },
    select: { respondentId: true, questionId: true, rawValue: true },
  });
  const questionCode = new Map(
    a.template.questions.map((q) => [q.id, q.code] as const)
  );

  const out: AxisScoreOut[] = [];
  for (const axis of AXIS_IDS) {
    const questions: ScoringQuestion[] = a.template.questions
      .filter((q) => q.axis === axis)
      .map((q) => ({
        code: q.code,
        ordinal: q.ordinal,
        type: q.type,
        weight: q.weight,
        inverted: q.inverted,
        scaleLabels: q.scaleLabels,
      }));
    const answers: ScoringAnswer[] = responses
      .map((r): ScoringAnswer | null => {
        const code = questionCode.get(r.questionId);
        return code
          ? {
              respondentId: r.respondentId,
              questionCode: code,
              rawValue: r.rawValue,
            }
          : null;
      })
      .filter((x): x is ScoringAnswer => x !== null);

    const result = computeAxisScore(
      questions,
      answers,
      a.template.contestedSpread
    );

    // `computed` é write-once: se já existe, o upsert não o toca. Reescrevê-lo
    // apagaria a única referência que a auditoria tem do número original.
    const existing = await db.meridianAxisScore.findUnique({
      where: { assessmentId_axis: { assessmentId: a.id, axis } },
      select: { id: true, computed: true, final: true, status: true },
    });
    if (existing) {
      // Um eixo cujo computado o revisor confirmou (kind = CONFIRMATION) não
      // volta à fila enquanto o número for o que ele viu: a dispersão é a mesma
      // e a decisão já foi tomada (D-29, FR-029a). Se as respostas mudaram e o
      // computado novo é outro, a confirmação não cobre mais o eixo e ele volta
      // a CONTESTED. Olha-se o `kind`, não "antes == depois".
      const lastConfirmation =
        existing.status !== "OVERRIDDEN" && result.status === "CONTESTED"
          ? await db.meridianOverride.findFirst({
              where: {
                tenantId: ctx.tenantId,
                assessmentId: a.id,
                axis,
                kind: "CONFIRMATION",
              },
              orderBy: { createdAt: "desc" },
              select: { toScore: true },
            })
          : null;
      const confirmed =
        lastConfirmation !== null && lastConfirmation.toScore === result.score;
      await db.meridianAxisScore.update({
        where: { id: existing.id },
        data: {
          confidence: result.confidence,
          respondentCount: result.respondentCount,
          spread: result.spread,
          note: result.note,
          // Um eixo já sobrescrito não volta a CONTESTED: a decisão humana
          // vale mais do que a dispersão que a motivou.
          status: (() => {
            if (existing.status === "OVERRIDDEN") {
              return "OVERRIDDEN";
            }
            return confirmed ? "COMPUTED" : result.status;
          })(),
        },
      });
    } else {
      await db.meridianAxisScore.create({
        data: {
          tenantId: ctx.tenantId,
          assessmentId: a.id,
          axis,
          computed: result.score,
          confidence: result.confidence,
          respondentCount: result.respondentCount,
          spread: result.spread,
          status: result.status,
          note: result.note,
        },
      });
    }

    const finalScore = existing?.final ?? existing?.computed ?? result.score;
    if (finalScore < a.template.gapThreshold) {
      await deriveGapIfMissing(db, ctx, {
        assessmentId: a.id,
        assessmentCode: a.code,
        axis,
        score: finalScore,
        confidence: result.confidence,
      });
    }

    out.push({
      axis,
      computed: existing?.computed ?? result.score,
      confidence: result.confidence,
      respondentCount: result.respondentCount,
      spread: result.spread,
      status: result.status,
      note: result.note,
    });
  }

  await logMeridianAudit(db, ctx, {
    action: "meridian.scoring.run",
    entityType: "meridian.axisscore",
    entityId: a.id,
    target: `${a.code} · ${a.orgName}`,
    note: "Scoring executado — determinístico para o mesmo template e respostas.",
  });

  if (a.benchmarkOptIn) {
    await contributeInTx(db, ctx, a.id);
  }

  return out;
}

/** Severidade e custo de atraso derivados da distância até o limiar. Quanto
 *  mais fundo o eixo, mais caro deixar parado — a fórmula é a mesma para todos
 *  os eixos para que a ordenação do registro seja comparável. */
function derivedFrom(score: number, threshold: number) {
  const gapSize = Math.max(0, threshold - score);
  const ratio = threshold === 0 ? 0 : gapSize / threshold;
  const severity = ratio >= 0.5 ? "HIGH" : ratio >= 0.25 ? "MEDIUM" : "LOW";
  return {
    severity: severity as "HIGH" | "MEDIUM" | "LOW",
    costOfDelay: Math.min(100, Math.round(ratio * 100) + gapSize),
    effort: (ratio >= 0.5 ? "L" : ratio >= 0.25 ? "M" : "S") as "S" | "M" | "L",
  };
}

async function deriveGapIfMissing(
  db: Db,
  ctx: MeridianContext,
  input: {
    assessmentId: string;
    assessmentCode: string;
    axis: MeridianAxis;
    score: number;
    confidence: number;
  }
): Promise<void> {
  const exists = await db.meridianGap.findFirst({
    where: {
      tenantId: ctx.tenantId,
      assessmentId: input.assessmentId,
      axis: input.axis,
      derived: true,
    },
    select: { id: true },
  });
  if (exists) {
    return;
  }

  const meta = AXES[input.axis];
  const { severity, costOfDelay, effort } = derivedFrom(input.score, 60);
  const code = await nextCode({
    db,
    tenantId: ctx.tenantId,
    kind: "gap",
    prefix: "G",
  });
  const gap = await db.meridianGap.create({
    data: {
      tenantId: ctx.tenantId,
      code,
      assessmentId: input.assessmentId,
      axis: input.axis,
      statement: `${meta.label} abaixo do limiar (${input.score}): ${meta.desc.toLowerCase()} sem sustentação demonstrada.`,
      severity,
      effort,
      costOfDelay,
      // Achado derivado de score nasce como medição só quando a confiança
      // sustenta. Abaixo disso é estimativa — e o relatório precisa dizer isso.
      confidence:
        input.confidence >= 0.75
          ? "MEASURED"
          : input.confidence >= 0.5
            ? "ESTIMATED"
            : "DECLARED",
      ownerLabel: meta.label,
      state: "OPEN",
      derived: true,
    },
    select: { id: true },
  });

  await logMeridianAudit(db, ctx, {
    action: "meridian.gap.derive",
    entityType: "meridian.gap",
    entityId: gap.id,
    target: `${code} · ${input.assessmentCode} · ${meta.label}`,
    diff: [["Estado", "—", "OPEN"]],
  });
}
