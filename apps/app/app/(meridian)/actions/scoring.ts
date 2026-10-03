"use server";

import type { MeridianAxis } from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireMeridianContext,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { cuid, type Result, safeAction } from "../../actions/_base";
import { type AxisScoreOut, runScoringInTx } from "./_scoring-core";
import { requireDecisionsOpen } from "./_shared";

// Scoring e fila de revisão — US3.

const AxisEnum = z.enum([
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
]);

const RunSchema = z.object({ assessmentId: cuid });

export async function runScoring(
  raw: z.input<typeof RunSchema>
): Promise<Result<AxisScoreOut[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("scoring.run");
    const input = RunSchema.parse(raw);
    const out = await withTenantDb(ctx.tenantId, async (db) => {
      await requireDecisionsOpen(db, ctx.tenantId, input.assessmentId);
      return runScoringInTx(db, ctx, input.assessmentId);
    });
    revalidatePath("/meridian");
    return out;
  });
}

export type QueueItem = {
  assessmentId: string;
  assessmentCode: string;
  orgName: string;
  axis: MeridianAxis;
  spread: number;
  confidence: number;
  note: string | null;
};

/** Eixos contestados de toda a carteira do tenant. Fila global porque a
 *  discordância não espera alguém abrir o assessment certo. */
export async function listReviewQueue(): Promise<Result<QueueItem[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.meridianAxisScore.findMany({
        where: { tenantId: ctx.tenantId, status: "CONTESTED" },
        orderBy: { spread: "desc" },
        include: {
          assessment: { select: { id: true, code: true, orgName: true } },
        },
      });
      return rows.map(
        (s): QueueItem => ({
          assessmentId: s.assessment.id,
          assessmentCode: s.assessment.code,
          orgName: s.assessment.orgName,
          axis: s.axis,
          spread: s.spread,
          confidence: Number(s.confidence),
          note: s.note,
        })
      );
    });
  });
}

export type DivergenceRow = {
  questionCode: string;
  questionText: string;
  evidenceCount: number;
  answers: {
    respondentName: string;
    respondentRole: string;
    displayValue: string;
    normalized: number;
    evidence: { id: string; fileName: string }[];
  }[];
};

const DivergenceSchema = z.object({ assessmentId: cuid, axis: AxisEnum });

/** Divergência resposta a resposta. Exige `evidence.read`: ver quem disse o quê
 *  já é acesso a conteúdo de evidência, e cada leitura entra na trilha. */
export async function getDivergence(
  raw: z.input<typeof DivergenceSchema>
): Promise<Result<DivergenceRow[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("evidence.read");
    const input = DivergenceSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const responses = await db.meridianResponse.findMany({
        where: {
          tenantId: ctx.tenantId,
          respondent: {
            assessmentId: input.assessmentId,
            axis: input.axis,
            status: { not: "REVOKED" },
          },
        },
        include: {
          respondent: { select: { name: true, role: true } },
          question: {
            select: {
              code: true,
              text: true,
              type: true,
              scaleLabels: true,
              ordinal: true,
            },
          },
          evidence: { select: { id: true, fileName: true } },
        },
        orderBy: [{ question: { ordinal: "asc" } }],
      });

      const byQuestion = new Map<string, DivergenceRow>();
      for (const r of responses) {
        const key = r.question.code;
        const row = byQuestion.get(key) ?? {
          questionCode: key,
          questionText: r.question.text,
          evidenceCount: 0,
          answers: [],
        };
        row.evidenceCount += r.evidence.length;
        row.answers.push({
          respondentName: r.respondent.name,
          respondentRole: r.respondent.role,
          displayValue: displayValue(
            r.question.type,
            r.question.scaleLabels,
            r.rawValue
          ),
          normalized: Number(r.normalized),
          evidence: r.evidence,
        });
        byQuestion.set(key, row);
      }

      // Só interessa o que divergiu — mostrar as concordâncias afoga o sinal.
      return [...byQuestion.values()].filter(
        (row) =>
          row.answers.length > 1 &&
          new Set(row.answers.map((a) => a.normalized)).size > 1
      );
    });
  });
}

const LIKERT_LABELS = [
  "Discordo forte",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo forte",
];

function displayValue(
  type: string,
  scaleLabels: string[],
  rawValue: number
): string {
  if (type === "LIKERT") {
    return LIKERT_LABELS[rawValue] ?? String(rawValue);
  }
  if (type === "YES_NO") {
    return rawValue === 0 ? "Sim" : "Não";
  }
  return scaleLabels[rawValue] ?? String(rawValue);
}
