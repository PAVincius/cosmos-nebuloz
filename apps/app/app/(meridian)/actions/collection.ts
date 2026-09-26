"use server";

import type { MeridianAxis } from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import {
  MeridianRuleError,
  requireMeridianPermissionContext,
  StateConflictError,
} from "@/lib/meridian/guards";
import {
  calcularExpiracaoDaReemissao,
  hashToken,
  issueToken,
} from "@/lib/meridian/respondent-token";
import { cuid, nnStr, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit } from "./_shared";
import { runScoringInTx } from "./scoring";

// Coleta multi-respondente — US2.

const AxisEnum = z.enum([
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
]);

// nnStr só faz trim (tira espaço nas pontas) — não barra \n/\r no meio da
// string. Sem essa checagem, um nome/role com quebra de linha vira linha
// falsa no .txt/.csv de reemissão em lote (Vigia, item 2 MÉDIO).
const singleLineStr = nnStr.refine((v) => !/[\r\n]/.test(v), {
  message: "Não pode conter quebra de linha.",
});

const AssignSchema = z.object({
  assessmentId: cuid,
  name: singleLineStr,
  role: singleLineStr,
  email: z.string().email(),
  axis: AxisEnum,
});

/**
 * Atribui um respondente a um eixo e devolve o token **em claro uma única vez**,
 * para montagem do link. O banco guarda só o hash: um dump com tokens legíveis
 * daria acesso à bateria de todos os respondentes de todos os assessments.
 */
export async function assignRespondent(
  raw: z.input<typeof AssignSchema>
): Promise<Result<{ id: string; token: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = AssignSchema.parse(raw);

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const assessment = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: { id: true, code: true, deadline: true, status: true },
      });
      if (!assessment) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      if (assessment.status === "FINALISED") {
        throw new StateConflictError(
          "collection.finalised",
          "Assessment finalizado não recebe novos respondentes."
        );
      }

      const token = issueToken();
      const respondent = await db.meridianRespondent.create({
        data: {
          tenantId: ctx.tenantId,
          assessmentId: assessment.id,
          name: input.name,
          role: input.role,
          email: input.email,
          axis: input.axis,
          status: "INVITED",
          tokenHash: hashToken(token),
          tokenExpiresAt: assessment.deadline,
          invitedAt: new Date(),
        },
        select: { id: true },
      });

      // Atribuir o primeiro respondente abre a coleta: um assessment em
      // rascunho com gente convidada é um estado que confunde a carteira.
      if (assessment.status === "DRAFT") {
        await db.meridianAssessment.update({
          where: { id: assessment.id },
          data: { status: "COLLECTING" },
        });
      }

      await logMeridianAudit(db, ctx, {
        action: "meridian.respondent.assign",
        entityType: "meridian.respondent",
        entityId: respondent.id,
        target: `${assessment.code} · ${input.name} · ${AXES[input.axis].label}`,
        diff: [["Eixo", "—", AXES[input.axis].label]],
      });

      return { id: respondent.id, token };
    });

    revalidatePath("/meridian");
    return created;
  });
}

const RevokeSchema = z.object({ respondentId: cuid });

/** Revogar regrava o hash com valor aleatório: o token antigo deixa de casar
 *  na hora, sem depender de lista de bloqueio nem de expiração. */
export async function revokeRespondent(
  raw: z.input<typeof RevokeSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = RevokeSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const r = await db.meridianRespondent.findFirst({
        where: { id: input.respondentId, tenantId: ctx.tenantId },
        select: { id: true, name: true, status: true },
      });
      if (!r) {
        throw new MeridianRuleError(
          "respondent.not-found",
          "Respondente não encontrado nesta organização."
        );
      }
      await db.meridianRespondent.update({
        where: { id: r.id },
        data: { status: "REVOKED", tokenHash: hashToken(issueToken()) },
      });
      await logMeridianAudit(db, ctx, {
        action: "meridian.respondent.revoke",
        entityType: "meridian.respondent",
        entityId: r.id,
        target: r.name,
        diff: [["Status", r.status, "REVOKED"]],
      });
    });

    revalidatePath("/meridian");
  });
}

const ReissueSchema = z.object({ respondentId: cuid });

/**
 * Reemite o link do MESMO respondente — gira `tokenHash` como `revokeRespondent`,
 * mas sem tocar `status`: é o remédio pro link perdido antes de copiar (AS-112),
 * sem precisar revogar e reatribuir (o que perderia o respondente original).
 */
export async function reissueRespondentLink(
  raw: z.input<typeof ReissueSchema>
): Promise<Result<{ id: string; token: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = ReissueSchema.parse(raw);

    const reissued = await withTenantDb(ctx.tenantId, async (db) => {
      const r = await db.meridianRespondent.findFirst({
        where: { id: input.respondentId, tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          assessment: { select: { deadline: true } },
        },
      });
      if (!r) {
        throw new MeridianRuleError(
          "respondent.not-found",
          "Respondente não encontrado nesta organização."
        );
      }
      if (r.status === "DONE") {
        throw new MeridianRuleError(
          "reissue.already-done",
          `${r.name} já concluiu — o link não precisa ser reemitido.`
        );
      }
      if (r.status === "REVOKED") {
        throw new MeridianRuleError(
          "reissue.revoked",
          "Respondente revogado não recebe link novo — atribua um respondente novo pro eixo."
        );
      }
      const now = new Date();
      if (r.assessment.deadline.getTime() < now.getTime()) {
        throw new StateConflictError(
          "reissue.deadline-expired",
          "Prazo do assessment vencido — não é possível reemitir link."
        );
      }

      const token = issueToken();
      await db.meridianRespondent.update({
        where: { id: r.id },
        data: {
          tokenHash: hashToken(token),
          tokenExpiresAt: calcularExpiracaoDaReemissao(
            r.assessment.deadline,
            now
          ),
        },
      });
      await logMeridianAudit(db, ctx, {
        action: "meridian.respondent.reissue",
        entityType: "meridian.respondent",
        entityId: r.id,
        target: r.name,
        diff: [["Link", "ativo", "reemitido"]],
      });

      return { id: r.id, token };
    });

    revalidatePath("/meridian");
    return reissued;
  });
}

const ReissueAllSchema = z.object({ assessmentId: cuid });

const PENDING_STATUSES = ["INVITED", "PENDING", "OVERDUE"] as const;

/**
 * Reemite, numa única passada, todo respondente pendente (`INVITED`/`PENDING`/
 * `OVERDUE`) do assessment — o remédio pro cenário real do incidente (10 links
 * perdidos de uma vez). `DONE`/`REVOKED` não são tocados. Lista vazia de
 * elegíveis devolve sucesso com `reissued: []`, não erro: a UI distingue "nada
 * pra reemitir" de falha.
 */
export async function reissuePendingLinks(
  raw: z.input<typeof ReissueAllSchema>
): Promise<
  Result<{
    assessmentId: string;
    reissued: Array<{
      respondentId: string;
      name: string;
      axis: MeridianAxis;
      token: string;
    }>;
  }>
> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = ReissueAllSchema.parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const assessment = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: { id: true, deadline: true },
      });
      if (!assessment) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      const now = new Date();
      if (assessment.deadline.getTime() < now.getTime()) {
        throw new StateConflictError(
          "reissue.deadline-expired",
          "Prazo do assessment vencido — não é possível reemitir link."
        );
      }

      const pendentes = await db.meridianRespondent.findMany({
        where: {
          assessmentId: assessment.id,
          tenantId: ctx.tenantId,
          status: { in: [...PENDING_STATUSES] },
        },
        select: { id: true, name: true, axis: true },
      });

      const reissuedList: Array<{
        respondentId: string;
        name: string;
        axis: MeridianAxis;
        token: string;
      }> = [];
      for (const r of pendentes) {
        const token = issueToken();
        await db.meridianRespondent.update({
          where: { id: r.id },
          data: {
            tokenHash: hashToken(token),
            tokenExpiresAt: calcularExpiracaoDaReemissao(
              assessment.deadline,
              now
            ),
          },
        });
        await logMeridianAudit(db, ctx, {
          action: "meridian.respondent.reissue",
          entityType: "meridian.respondent",
          entityId: r.id,
          target: `${r.name} · ${AXES[r.axis].label}`,
          diff: [["Link", "ativo", "reemitido"]],
        });
        reissuedList.push({
          respondentId: r.id,
          name: r.name,
          axis: r.axis,
          token,
        });
      }

      return { assessmentId: assessment.id, reissued: reissuedList };
    });

    revalidatePath("/meridian");
    return result;
  });
}

const RemindSchema = z.object({ respondentId: cuid });

export async function sendReminder(
  raw: z.input<typeof RemindSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = RemindSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const r = await db.meridianRespondent.findFirst({
        where: { id: input.respondentId, tenantId: ctx.tenantId },
        select: { id: true, name: true, status: true },
      });
      if (!r) {
        throw new MeridianRuleError(
          "respondent.not-found",
          "Respondente não encontrado nesta organização."
        );
      }
      // Lembrete a quem já concluiu é a forma mais rápida de treinar a pessoa
      // a ignorar os próximos.
      if (r.status === "DONE") {
        throw new MeridianRuleError(
          "reminder.already-done",
          `${r.name} já concluiu — lembretes cessam na conclusão.`
        );
      }
      if (r.status === "REVOKED") {
        throw new MeridianRuleError(
          "reminder.revoked",
          "Respondente revogado não recebe lembrete."
        );
      }
      await db.meridianRespondent.update({
        where: { id: r.id },
        data: { lastRemindedAt: new Date() },
      });
    });
  });
}

const CloseSchema = z.object({ assessmentId: cuid });

/**
 * Fecha a coleta e dispara o scoring.
 *
 * Recusa enquanto houver eixo sem respondente ativo (FR-011) — um eixo sem
 * dono não produz score, produz zero, e zero num relatório de prontidão lê-se
 * como "medimos e deu zero".
 *
 * Aceita respostas pendentes (FR-012), devolvendo a contagem para a UI declarar
 * o impacto na confiança em vez de escondê-lo.
 */
export async function closeCollection(
  raw: z.input<typeof CloseSchema>
): Promise<Result<{ pendingResponses: number }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("assessment.manage");
    const input = CloseSchema.parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        include: {
          template: { select: { questions: { select: { axis: true } } } },
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
      if (a.status === "FINALISED") {
        throw new StateConflictError(
          "collection.finalised",
          "Assessment já finalizado."
        );
      }

      const covered = new Set(a.respondents.map((r) => r.axis));
      const uncovered = AXIS_IDS.filter((x) => !covered.has(x));
      if (uncovered.length > 0) {
        throw new StateConflictError(
          "collection.uncovered-axis",
          "Há eixo sem respondente — o assessment não fecha coleta assim.",
          uncovered.map((x) => AXES[x].label)
        );
      }

      const questionsByAxis = new Map<string, number>();
      for (const q of a.template.questions) {
        questionsByAxis.set(q.axis, (questionsByAxis.get(q.axis) ?? 0) + 1);
      }
      const expected = a.respondents.reduce(
        (sum, r) => sum + (questionsByAxis.get(r.axis) ?? 0),
        0
      );
      const done = await db.meridianResponse.count({
        where: {
          tenantId: ctx.tenantId,
          respondentId: { in: a.respondents.map((r) => r.id) },
        },
      });
      const pendingResponses = Math.max(0, expected - done);

      await db.meridianAssessment.update({
        where: { id: a.id },
        data: { status: "REVIEW", closedAt: new Date() },
      });

      await logMeridianAudit(db, ctx, {
        action: "meridian.collection.close",
        entityType: "meridian.assessment",
        entityId: a.id,
        target: `${a.code} · ${a.orgName}`,
        note:
          pendingResponses > 0
            ? `${pendingResponses} resposta(s) pendente(s) no fechamento — confidence dos eixos afetados cai.`
            : "Coleta completa.",
        diff: [["Status", a.status, "REVIEW"]],
      });

      // Scoring na mesma transação: coleta fechada sem score é um estado que
      // ninguém sabe interpretar na carteira.
      await runScoringInTx(db, ctx, a.id);

      return { pendingResponses };
    });

    revalidatePath("/meridian");
    return result;
  });
}
