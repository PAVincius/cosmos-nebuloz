"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { axisSlug } from "@/lib/meridian/axes";
import {
  MeridianRuleError,
  requireMeridianContext,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { buildPlan } from "@/lib/meridian/plan";
import { cuid, optStr, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit, requireDecisionsOpen } from "./_shared";

// Plano de 12 meses e export legível por máquina — US4.

export type PlanRow = {
  gapId: string;
  gapCode: string;
  quarter: number;
  seq: number;
  capacityNote: string | null;
};

const GenerateSchema = z.object({
  assessmentId: cuid,
  capacityNote: optStr,
});

/**
 * Gera o plano por ordenação topológica do DAG.
 *
 * A invariante é verificada **antes de gravar**: nenhum item pode cair em
 * trimestre anterior ao de um pré-requisito. Um plano gravado que viola isso é
 * pior do que nenhum plano, porque alguém vai executá-lo.
 */
export async function generatePlan(
  raw: z.input<typeof GenerateSchema>
): Promise<Result<PlanRow[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.write");
    const input = GenerateSchema.parse(raw);

    const rows = await withTenantDb(ctx.tenantId, async (db) => {
      const assessment = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        select: { id: true, code: true, orgName: true },
      });
      if (!assessment) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }
      await requireDecisionsOpen(db, ctx.tenantId, assessment.id);

      const gaps = await db.meridianGap.findMany({
        where: { tenantId: ctx.tenantId, assessmentId: assessment.id },
        select: { id: true, code: true, costOfDelay: true },
      });
      if (gaps.length === 0) {
        throw new MeridianRuleError(
          "plan.no-gaps",
          "Não há gaps derivados neste assessment — rode o scoring antes de gerar o plano."
        );
      }

      const byCode = new Map(gaps.map((g) => [g.code, g.id]));
      const deps = await db.meridianGapDependency.findMany({
        where: {
          tenantId: ctx.tenantId,
          gapId: { in: gaps.map((g) => g.id) },
        },
        include: {
          gap: { select: { code: true } },
          dependsOn: { select: { code: true } },
        },
      });
      const edges = deps.map((d) => ({
        from: d.gap.code,
        to: d.dependsOn.code,
      }));

      const plan = buildPlan(
        gaps.map((g) => ({ code: g.code, costOfDelay: g.costOfDelay })),
        edges
      );

      const position = new Map(plan.map((p) => [p.gapCode, p]));
      for (const e of edges) {
        const dependent = position.get(e.from);
        const prereq = position.get(e.to);
        if (dependent && prereq && dependent.seq <= prereq.seq) {
          throw new MeridianRuleError(
            "plan.order-violation",
            `${e.from} ficaria antes do pré-requisito ${e.to}.`
          );
        }
      }

      // Regerar substitui o plano inteiro: itens do plano anterior que sumiram
      // do grafo não podem sobreviver como fantasma.
      await db.meridianPlanItem.deleteMany({
        where: { tenantId: ctx.tenantId, assessmentId: assessment.id },
      });
      await db.meridianPlanItem.createMany({
        data: plan.map((p) => ({
          tenantId: ctx.tenantId,
          assessmentId: assessment.id,
          gapId: byCode.get(p.gapCode) as string,
          quarter: p.quarter,
          seq: p.seq,
          capacityNote: input.capacityNote ?? null,
        })),
      });
      await db.meridianGap.updateMany({
        where: {
          tenantId: ctx.tenantId,
          assessmentId: assessment.id,
          state: "OPEN",
        },
        data: { state: "PLANNED" },
      });

      await logMeridianAudit(db, ctx, {
        action: "meridian.plan.generate",
        entityType: "meridian.planitem",
        entityId: assessment.id,
        target: `${assessment.code} · ${assessment.orgName}`,
        note: `${plan.length} item(ns) sequenciado(s) por ordenação topológica.`,
      });

      return plan.map(
        (p): PlanRow => ({
          gapId: byCode.get(p.gapCode) as string,
          gapCode: p.gapCode,
          quarter: p.quarter,
          seq: p.seq,
          capacityNote: input.capacityNote ?? null,
        })
      );
    });

    revalidatePath("/meridian");
    return rows;
  });
}

export type PlanExport = {
  assessment: string;
  template_version: string;
  generated_at: string;
  axes: {
    axis: string;
    score: number;
    status: string;
    confidence: number;
  }[];
  gaps: {
    id: string;
    axis: string;
    severity: string;
    effort: string;
    cost_of_delay: number;
    finding_confidence: string;
    depends_on: string[];
    target_quarter: string;
    state: string;
    promoted_to?: { product: string; entity_id: string | null };
  }[];
  plan: { capacity_assumption: string | null; items: number };
};

const ExportSchema = z.object({ assessmentId: cuid });

/** Contrato em `specs/001-meridian-diagnose/contracts/plan-export.md`. Campo
 *  removido daqui é quebra de contrato para quem consome. */
export async function exportPlan(
  raw: z.input<typeof ExportSchema>
): Promise<Result<PlanExport>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const input = ExportSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.meridianAssessment.findFirst({
        where: { id: input.assessmentId, tenantId: ctx.tenantId },
        include: {
          template: { select: { version: true } },
          scores: true,
          planItems: { orderBy: { seq: "asc" } },
          gaps: {
            include: {
              dependencies: {
                include: { dependsOn: { select: { code: true } } },
              },
              promotions: {
                where: { revokedAt: null },
                orderBy: { promotedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      });
      if (!a) {
        throw new MeridianRuleError(
          "assessment.not-found",
          "Assessment não encontrado nesta organização."
        );
      }

      const quarterOf = new Map(
        a.planItems.map((p) => [p.gapId, p.quarter] as const)
      );

      return {
        assessment: a.code,
        template_version: a.template.version,
        generated_at: new Date().toISOString(),
        axes: a.scores.map((s) => ({
          axis: axisSlug(s.axis),
          score: s.final ?? s.computed,
          status: s.status.toLowerCase(),
          confidence: Number(s.confidence),
        })),
        gaps: a.gaps
          // Gap sem plano gerado não entra no export: o consumidor sequencia
          // trabalho, e item sem trimestre não é sequenciável.
          .filter((g) => quarterOf.has(g.id))
          .map((g) => {
            const p = g.promotions[0];
            return {
              id: g.code,
              axis: axisSlug(g.axis),
              severity: g.severity.toLowerCase(),
              effort: g.effort,
              cost_of_delay: g.costOfDelay,
              finding_confidence: g.confidence.toLowerCase(),
              depends_on: g.dependencies.map((d) => d.dependsOn.code),
              target_quarter: `Q${quarterOf.get(g.id)}`,
              state: g.state.toLowerCase(),
              ...(p
                ? {
                    promoted_to: {
                      product: p.targetProduct.toLowerCase(),
                      entity_id: p.targetEntityId,
                    },
                  }
                : {}),
            };
          }),
        plan: {
          capacity_assumption: a.planItems[0]?.capacityNote ?? null,
          items: a.planItems.length,
        },
      };
    });
  });
}
