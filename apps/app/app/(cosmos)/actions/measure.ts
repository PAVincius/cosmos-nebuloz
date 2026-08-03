"use server";

// measure.ts — Measure & Grow (FR-013, story-032). Avaliação por competência
// SAFe (escala 1–5) e as ações de melhoria que saem dela.
//
// Até aqui CompetencyAssessment só era lido: a nota chegava ao Cosmos por
// outra superfície ou por seed, e ImprovementAction — que é o que transforma
// avaliação em mudança — não aparecia na tela. Medir sem registrar ação é
// termômetro, não Measure & Grow.
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { SAFE_COMPETENCIES } from "../../actions/measure-grow/schema";

const SCREEN_PATH = "/cosmos/measure";

// Papéis que conduzem Measure & Grow no SAFe: o RTE no nível do trem, o SM no
// nível do time, e o ADMIN do tenant.
const ASSESSOR_ROLES = ["ADMIN", "RTE", "SM"] as const;

const CompetencyKeySchema = z.enum(
  SAFE_COMPETENCIES.map((c) => c.key) as unknown as [string, ...string[]]
);
const ScopeSchema = z.enum(["team", "art", "value_stream", "portfolio"]);

function competencyLabel(key: string): string {
  return SAFE_COMPETENCIES.find((c) => c.key === key)?.label ?? key;
}

export type CompetencyScoreView = {
  competency: string;
  competencyLabel: string;
  score: number | null;
  prevScore: number | null;
  delta: number | null;
  assessedAt: Date | null;
};

export async function listCompetencyScores(): Promise<
  Result<CompetencyScoreView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const assessments = await database.competencyAssessment.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { assessedAt: "desc" },
      select: {
        competency: true,
        score: true,
        scope: true,
        scopeId: true,
        assessedAt: true,
      },
    });

    // Group every assessment per competency (already ordered newest-first by
    // the query) so we can read off both the latest and the prior cycle.
    const byCompetency = new Map<string, (typeof assessments)[number][]>();
    for (const a of assessments) {
      const history = byCompetency.get(a.competency) ?? [];
      history.push(a);
      byCompetency.set(a.competency, history);
    }

    return SAFE_COMPETENCIES.map(({ key, label }) => {
      const history = byCompetency.get(key) ?? [];
      const [latest] = history;
      // "Ciclo anterior" só existe dentro do mesmo escopo. A avaliação de um
      // time e a de outro são duas medições distintas, não duas medições da
      // mesma coisa: subtrair uma da outra produziria um delta que não
      // descreve a evolução de ninguém.
      const prior = latest
        ? history.find(
            (a, i) =>
              i > 0 && a.scope === latest.scope && a.scopeId === latest.scopeId
          )
        : undefined;
      const score = latest ? Number(latest.score) : null;
      const prevScore = prior ? Number(prior.score) : null;
      return {
        competency: key,
        competencyLabel: label,
        score,
        prevScore,
        delta:
          score !== null && prevScore !== null
            ? Number((score - prevScore).toFixed(1))
            : null,
        assessedAt: latest?.assessedAt ?? null,
      };
    });
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const RecordAssessmentSchema = z.object({
  competency: CompetencyKeySchema,
  // Escala 1–5 do Measure & Grow. Nota fora dela não é "dado ruim", é dado de
  // outra escala, e o radar da tela desenha sobre 5 fixo.
  score: z.number().min(1).max(5),
  scope: ScopeSchema,
  scopeId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export async function recordCompetencyAssessment(
  input: z.infer<typeof RecordAssessmentSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole([...ASSESSOR_ROLES], ctx);
    const { competency, score, scope, scopeId, notes } =
      RecordAssessmentSchema.parse(input);

    const created = await database.competencyAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        competency,
        score,
        scope,
        scopeId,
        notes: notes ?? null,
        // Avaliação é registro histórico: quem avaliou vem da sessão, nunca do
        // cliente, senão a autoria do ciclo anterior não vale como evidência.
        assessedById: ctx.userId,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "competency_assessment",
      entityId: created.id,
      diff: { competency, score: String(score), scope, scopeId },
    });
    revalidatePath(SCREEN_PATH);

    return { id: created.id };
  });
}

export type ImprovementActionView = {
  id: string;
  title: string;
  status: string;
  competencyLabel: string | null;
  dueDate: string | null;
};

export type ImprovementActionsView = {
  items: ImprovementActionView[];
  total: number;
  done: number;
  /** conclusão sobre ações vivas; null (nunca 0) quando não há ação viva */
  completionPct: number | null;
};

export async function listImprovementActions(): Promise<
  Result<ImprovementActionsView>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.improvementAction.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        relatedMetric: true,
        dueDate: true,
        assessment: { select: { competency: true } },
      },
    });

    // Ação cancelada sai do denominador: foi abandonada, não está pendente nem
    // foi concluída, e mantê-la no denominador faria abandonar ações derrubar a
    // taxa como se fosse atraso.
    const live = rows.filter((r) => r.status !== "CANCELLED");
    const done = live.filter((r) => r.status === "DONE").length;

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        competencyLabel: r.assessment
          ? competencyLabel(r.assessment.competency)
          : null,
        dueDate: r.dueDate?.toISOString() ?? null,
      })),
      total: rows.length,
      done,
      completionPct:
        live.length > 0 ? Math.round((done / live.length) * 100) : null,
    };
  });
}

const CreateImprovementActionSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  scope: ScopeSchema,
  scopeId: z.string().min(1),
  assessmentId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export async function createImprovementAction(
  input: z.infer<typeof CreateImprovementActionSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole([...ASSESSOR_ROLES], ctx);
    const { title, scope, scopeId, assessmentId, dueDate } =
      CreateImprovementActionSchema.parse(input);

    // Guarda IDOR — FK vinda do cliente tem que pertencer a este tenant.
    if (assessmentId) {
      const assessment = await database.competencyAssessment.findFirst({
        where: { id: assessmentId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!assessment) {
        throw new Error("Avaliação de competência inválida.");
      }
    }

    const created = await database.improvementAction.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        scope,
        scopeId,
        assessmentId: assessmentId ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "OPEN",
        source: "manual",
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "improvement_action",
      entityId: created.id,
      diff: { title, scope, scopeId },
    });
    revalidatePath(SCREEN_PATH);

    return { id: created.id };
  });
}
