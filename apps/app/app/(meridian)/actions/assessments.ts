"use server";

import type {
  MeridianAssessmentStatus,
  MeridianAxis,
  MeridianScoreStatus,
} from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { compositeOf } from "@/lib/meridian/composite";
import {
  MeridianRuleError,
  requireMeridianContext,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { cuid, nnStr, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit, nextCode } from "./_shared";

// Carteira e detalhe de assessment — US1.

export type AxisScoreView = {
  axis: MeridianAxis;
  computed: number;
  final: number | null;
  confidence: number;
  respondentCount: number;
  spread: number;
  status: MeridianScoreStatus;
  note: string | null;
};

export type AssessmentRow = {
  id: string;
  code: string;
  orgName: string;
  sector: string;
  sizeBand: string;
  templateVersion: string;
  status: MeridianAssessmentStatus;
  deadline: string;
  consultantId: string;
  benchmarkOptIn: boolean;
  reassessmentOfCode: string | null;
  responses: { done: number; total: number };
  evidence: number;
  scores: AxisScoreView[] | null;
  composite: number | null;
};

export type RespondentView = {
  id: string;
  name: string;
  role: string;
  email: string;
  axis: MeridianAxis;
  status: string;
  invitedAt: string | null;
  lastRemindedAt: string | null;
  completedAt: string | null;
};

export type OverrideView = {
  id: string;
  code: string;
  axis: MeridianAxis;
  fromScore: number;
  toScore: number;
  rationale: string;
  reviewerId: string;
  createdAt: string;
};

export type PlanItemView = {
  gapId: string;
  gapCode: string;
  quarter: number;
  seq: number;
  capacityNote: string | null;
};

export type AssessmentDetail = AssessmentRow & {
  openedAt: string;
  closedAt: string | null;
  respondents: RespondentView[];
  overrides: OverrideView[];
  /** Plano já gravado. Vazio quando ainda não foi gerado — a aba precisa
   *  distinguir "não gerado" de "gerado e vazio". */
  planItems: PlanItemView[];
  contestedSpread: number;
  gapThreshold: number;
};

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

/** Progresso da coleta. `total` é perguntas do eixo × respondentes daquele
 *  eixo — não a bateria inteira: quem responde Data não deve nada em People. */
function expectedResponses(
  respondents: { axis: MeridianAxis }[],
  questionsByAxis: Map<MeridianAxis, number>
): number {
  return respondents.reduce(
    (sum, r) => sum + (questionsByAxis.get(r.axis) ?? 0),
    0
  );
}

const ListSchema = z.object({
  status: z.enum(["DRAFT", "COLLECTING", "REVIEW", "FINALISED"]).optional(),
});

export async function listAssessments(
  raw: z.input<typeof ListSchema> = {}
): Promise<Result<AssessmentRow[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const input = ListSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      // Uma consulta agregada de respostas por respondente, não N+1 por
      // assessment: a carteira precisa responder em menos de 2s com 200 linhas.
      const [rows, responseCounts] = await Promise.all([
        db.meridianAssessment.findMany({
          // tenantId vem da sessão, nunca do input — filtrar por tenant
          // recebido do cliente é o vazamento cross-tenant clássico.
          where: {
            tenantId: ctx.tenantId,
            ...(input.status ? { status: input.status } : {}),
          },
          orderBy: [{ openedAt: "desc" }],
          include: {
            template: {
              select: { version: true, questions: { select: { axis: true } } },
            },
            reassessmentOf: { select: { code: true } },
            respondents: { select: { axis: true } },
            scores: true,
            _count: { select: { evidence: true } },
          },
        }),
        db.meridianResponse.groupBy({
          by: ["respondentId"],
          where: { tenantId: ctx.tenantId },
          _count: { _all: true },
        }),
      ]);

      const respondentOwner = new Map(
        (
          await db.meridianRespondent.findMany({
            where: { tenantId: ctx.tenantId },
            select: { id: true, assessmentId: true },
          })
        ).map((r) => [r.id, r.assessmentId])
      );
      const doneByAssessment = new Map<string, number>();
      for (const c of responseCounts) {
        const asId = respondentOwner.get(c.respondentId);
        if (asId) {
          doneByAssessment.set(
            asId,
            (doneByAssessment.get(asId) ?? 0) + c._count._all
          );
        }
      }

      return rows.map((a): AssessmentRow => {
        const questionsByAxis = new Map<MeridianAxis, number>();
        for (const q of a.template.questions) {
          questionsByAxis.set(q.axis, (questionsByAxis.get(q.axis) ?? 0) + 1);
        }
        const scores = a.scores.length
          ? a.scores.map(
              (s): AxisScoreView => ({
                axis: s.axis,
                computed: s.computed,
                final: s.final,
                confidence: Number(s.confidence),
                respondentCount: s.respondentCount,
                spread: s.spread,
                status: s.status,
                note: s.note,
              })
            )
          : null;
        return {
          id: a.id,
          code: a.code,
          orgName: a.orgName,
          sector: a.sector,
          sizeBand: a.sizeBand,
          templateVersion: a.template.version,
          status: a.status,
          deadline: a.deadline.toISOString(),
          consultantId: a.consultantId,
          benchmarkOptIn: a.benchmarkOptIn,
          reassessmentOfCode: a.reassessmentOf?.code ?? null,
          responses: {
            done: doneByAssessment.get(a.id) ?? 0,
            total: expectedResponses(a.respondents, questionsByAxis),
          },
          evidence: a._count.evidence,
          scores,
          composite: scores ? compositeOf(scores) : null,
        };
      });
    });
  });
}

const GetSchema = z.object({ id: cuid });

export async function getAssessment(
  raw: z.input<typeof GetSchema>
): Promise<Result<AssessmentDetail>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const input = GetSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: {
          template: {
            select: {
              version: true,
              contestedSpread: true,
              gapThreshold: true,
              questions: { select: { axis: true } },
            },
          },
          reassessmentOf: { select: { code: true } },
          respondents: { orderBy: { createdAt: "asc" } },
          scores: true,
          overrides: { orderBy: { createdAt: "asc" } },
          planItems: {
            orderBy: { seq: "asc" },
            include: { gap: { select: { code: true } } },
          },
          _count: { select: { evidence: true } },
        },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }

      const questionsByAxis = new Map<MeridianAxis, number>();
      for (const q of a.template.questions) {
        questionsByAxis.set(q.axis, (questionsByAxis.get(q.axis) ?? 0) + 1);
      }
      const done = await db.meridianResponse.count({
        where: {
          tenantId: ctx.tenantId,
          respondent: { assessmentId: a.id },
        },
      });

      const scores = a.scores.length
        ? a.scores.map(
            (s): AxisScoreView => ({
              axis: s.axis,
              computed: s.computed,
              final: s.final,
              confidence: Number(s.confidence),
              respondentCount: s.respondentCount,
              spread: s.spread,
              status: s.status,
              note: s.note,
            })
          )
        : null;

      return {
        id: a.id,
        code: a.code,
        orgName: a.orgName,
        sector: a.sector,
        sizeBand: a.sizeBand,
        templateVersion: a.template.version,
        status: a.status,
        openedAt: a.openedAt.toISOString(),
        deadline: a.deadline.toISOString(),
        closedAt: iso(a.closedAt),
        consultantId: a.consultantId,
        benchmarkOptIn: a.benchmarkOptIn,
        reassessmentOfCode: a.reassessmentOf?.code ?? null,
        responses: {
          done,
          total: expectedResponses(a.respondents, questionsByAxis),
        },
        evidence: a._count.evidence,
        scores,
        composite: scores ? compositeOf(scores) : null,
        contestedSpread: a.template.contestedSpread,
        gapThreshold: a.template.gapThreshold,
        respondents: a.respondents.map(
          (r): RespondentView => ({
            id: r.id,
            name: r.name,
            role: r.role,
            email: r.email,
            axis: r.axis,
            status: r.status,
            invitedAt: iso(r.invitedAt),
            lastRemindedAt: iso(r.lastRemindedAt),
            completedAt: iso(r.completedAt),
          })
        ),
        planItems: a.planItems.map(
          (p): PlanItemView => ({
            gapId: p.gapId,
            gapCode: p.gap.code,
            quarter: p.quarter,
            seq: p.seq,
            capacityNote: p.capacityNote,
          })
        ),
        overrides: a.overrides.map(
          (o): OverrideView => ({
            id: o.id,
            code: o.code,
            axis: o.axis,
            fromScore: o.fromScore,
            toScore: o.toScore,
            rationale: o.rationale,
            reviewerId: o.reviewerId,
            createdAt: o.createdAt.toISOString(),
          })
        ),
      };
    });
  });
}

const CreateSchema = z.object({
  orgName: nnStr,
  sector: nnStr,
  sizeBand: nnStr,
  templateId: cuid,
  deadline: z.coerce.date(),
  benchmarkOptIn: z.boolean().default(false),
  reassessmentOfId: cuid.optional(),
});

export async function createAssessment(
  raw: z.input<typeof CreateSchema>
): Promise<Result<{ id: string; code: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = CreateSchema.parse(raw);

    // `withTenantDb` já abre uma transação interativa — não há $transaction
    // aninhada aqui, e a auditoria cai ou sobe junto com a escrita.
    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const template = await db.meridianTemplate.findFirst({
        where: { id: input.templateId, tenantId: ctx.tenantId },
        select: { id: true, version: true, lockedAt: true },
      });
      if (!template) {
        throw new MeridianRuleError(
          "template.not-found",
          "Versão de template não encontrada nesta organização."
        );
      }

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "assessment",
        prefix: "AS",
        pad: 3,
      });

      const assessment = await db.meridianAssessment.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          orgName: input.orgName,
          sector: input.sector,
          sizeBand: input.sizeBand,
          templateId: template.id,
          consultantId: ctx.userId,
          deadline: input.deadline,
          benchmarkOptIn: input.benchmarkOptIn,
          reassessmentOfId: input.reassessmentOfId ?? null,
        },
        select: { id: true, code: true },
      });

      // Congela a versão no primeiro uso (FR-006). A partir daqui, mudar um
      // peso do template reescreveria em silêncio um diagnóstico entregue.
      if (!template.lockedAt) {
        await db.meridianTemplate.update({
          where: { id: template.id },
          data: { lockedAt: new Date() },
        });
      }

      await logMeridianAudit(db, ctx, {
        action: "meridian.assessment.create",
        entityType: "meridian.assessment",
        entityId: assessment.id,
        target: `${assessment.code} · ${input.orgName}`,
        note: `Template ${template.version} congelado.`,
        diff: [["Status", "—", "DRAFT"]],
      });

      return assessment;
    });

    revalidatePath("/meridian");
    return created;
  });
}
