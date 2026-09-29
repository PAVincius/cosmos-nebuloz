"use server";

import type {
  MeridianAxis,
  MeridianConfidence,
  MeridianEffort,
  MeridianGapState,
  MeridianPromotionTarget,
  MeridianSeverity,
} from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AXES } from "@/lib/meridian/axes";
import { detectCycle } from "@/lib/meridian/graph";
import {
  MeridianRuleError,
  requireMeridianContext,
  requireMeridianPermissionContext,
} from "@/lib/meridian/guards";
import { cuid, nnStr, type Result, safeAction } from "../../actions/_base";
import { logMeridianAudit, nextCode } from "./_shared";

// Gap register canônico — US4.
//
// O registro atravessa assessments: um gap nasce num run e continua existindo,
// sendo reavaliado e fechado aqui, mesmo depois de virar trabalho em outro
// produto. Promover não transfere posse — se o Cosmos pudesse editar o
// enunciado, a próxima reavaliação não teria contra o quê comparar.

const AxisEnum = z.enum([
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
]);
const SeverityEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
const StateEnum = z.enum(["OPEN", "PLANNED", "PROMOTED", "RESOLVED"]);

export type GapRow = {
  id: string;
  code: string;
  assessmentId: string;
  assessmentCode: string;
  orgName: string;
  axis: MeridianAxis;
  statement: string;
  severity: MeridianSeverity;
  effort: MeridianEffort;
  costOfDelay: number;
  confidence: MeridianConfidence;
  ownerLabel: string;
  state: MeridianGapState;
  derived: boolean;
  since: string;
  evidenceCount: number;
  dependsOn: string[];
  promotion: {
    id: string;
    product: MeridianPromotionTarget;
    entityId: string | null;
    label: string;
  } | null;
};

const ListSchema = z.object({
  axis: AxisEnum.optional(),
  severity: SeverityEnum.optional(),
  state: StateEnum.optional(),
  assessmentId: cuid.optional(),
});

export async function listGapRegister(
  raw: z.input<typeof ListSchema> = {}
): Promise<Result<GapRow[]>> {
  return safeAction(async () => {
    const ctx = await requireMeridianContext();
    const input = ListSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.meridianGap.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.axis ? { axis: input.axis } : {}),
          ...(input.severity ? { severity: input.severity } : {}),
          ...(input.state ? { state: input.state } : {}),
          ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}),
        },
        orderBy: [{ costOfDelay: "desc" }, { code: "asc" }],
        include: {
          assessment: {
            select: {
              code: true,
              orgName: true,
              _count: { select: { evidence: true } },
            },
          },
          dependencies: { include: { dependsOn: { select: { code: true } } } },
          promotions: {
            where: { revokedAt: null },
            orderBy: { promotedAt: "desc" },
            take: 1,
          },
        },
      });

      return rows.map((g): GapRow => {
        const p = g.promotions[0];
        return {
          id: g.id,
          code: g.code,
          assessmentId: g.assessmentId,
          assessmentCode: g.assessment.code,
          orgName: g.assessment.orgName,
          axis: g.axis,
          statement: g.statement,
          severity: g.severity,
          effort: g.effort,
          costOfDelay: g.costOfDelay,
          confidence: g.confidence,
          ownerLabel: g.ownerLabel,
          state: g.state,
          derived: g.derived,
          since: g.createdAt.toISOString(),
          evidenceCount: g.assessment._count.evidence,
          dependsOn: g.dependencies.map((d) => d.dependsOn.code),
          promotion: p
            ? {
                id: p.id,
                product: p.targetProduct,
                entityId: p.targetEntityId,
                label: p.targetLabel,
              }
            : null,
        };
      });
    });
  });
}

const UpsertSchema = z.object({
  id: cuid.optional(),
  assessmentId: cuid,
  axis: AxisEnum,
  statement: z.string().trim().min(10).max(2000),
  severity: SeverityEnum,
  effort: z.enum(["S", "M", "L"]),
  costOfDelay: z.number().int().min(0).max(100),
  confidence: z.enum(["MEASURED", "ESTIMATED", "DECLARED"]),
  ownerLabel: nnStr,
});

export async function upsertGap(
  raw: z.input<typeof UpsertSchema>
): Promise<Result<{ id: string; code: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.write");
    const input = UpsertSchema.parse(raw);

    const saved = await withTenantDb(ctx.tenantId, async (db) => {
      if (input.id) {
        const before = await db.meridianGap.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
        });
        if (!before) {
          throw new MeridianRuleError(
            "gap.not-found",
            "Gap não encontrado nesta organização."
          );
        }
        const after = await db.meridianGap.update({
          where: { id: before.id },
          data: {
            axis: input.axis,
            statement: input.statement,
            severity: input.severity,
            effort: input.effort,
            costOfDelay: input.costOfDelay,
            confidence: input.confidence,
            ownerLabel: input.ownerLabel,
          },
          select: { id: true, code: true },
        });
        await logMeridianAudit(db, ctx, {
          action: "meridian.gap.update",
          entityType: "meridian.gap",
          entityId: after.id,
          target: `${after.code} · ${AXES[input.axis].label}`,
          diff: (
            [
              ["Severidade", before.severity, input.severity],
              [
                "Custo de atraso",
                String(before.costOfDelay),
                String(input.costOfDelay),
              ],
              ["Enunciado", before.statement, input.statement],
            ] as [string, string, string][]
          ).filter((r) => r[1] !== r[2]),
        });
        return after;
      }

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
          statement: input.statement,
          severity: input.severity,
          effort: input.effort,
          costOfDelay: input.costOfDelay,
          confidence: input.confidence,
          ownerLabel: input.ownerLabel,
          // Gap criado à mão entra no mesmo DAG e no mesmo ranking; `derived`
          // só marca a origem, para o scoring não recriá-lo depois.
          derived: false,
        },
        select: { id: true, code: true },
      });
      await logMeridianAudit(db, ctx, {
        action: "meridian.gap.create",
        entityType: "meridian.gap",
        entityId: gap.id,
        target: `${gap.code} · ${AXES[input.axis].label}`,
        diff: [["Estado", "—", "OPEN"]],
      });
      return gap;
    });

    revalidatePath("/meridian");
    return saved;
  });
}

const DeleteSchema = z.object({ id: cuid });

export async function deleteGap(
  raw: z.input<typeof DeleteSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.write");
    const input = DeleteSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const gap = await db.meridianGap.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: { promotions: { where: { revokedAt: null } } },
      });
      if (!gap) {
        throw new MeridianRuleError(
          "gap.not-found",
          "Gap não encontrado nesta organização."
        );
      }
      // Apagar um gap promovido deixaria trabalho em outro produto apontando
      // para nada — e é o gap que diz o que aquele trabalho existe para fechar.
      if (gap.promotions.length > 0) {
        throw new MeridianRuleError(
          "gap.promoted",
          `${gap.code} está promovido — revogue a promoção antes de remover.`
        );
      }
      await db.meridianGap.delete({ where: { id: gap.id } });
      await logMeridianAudit(db, ctx, {
        action: "meridian.gap.delete",
        entityType: "meridian.gap",
        entityId: gap.id,
        target: gap.code,
        diff: [["Estado", gap.state, "—"]],
      });
    });

    revalidatePath("/meridian");
  });
}

const LinkSchema = z.object({ gapId: cuid, dependsOnGapId: cuid });

/** Cria a aresta `gap → dependsOn`. Recusa qualquer escrita que feche ciclo,
 *  nomeando os gaps do ciclo — a mensagem precisa dizer *onde* fechou. */
export async function linkGapDependency(
  raw: z.input<typeof LinkSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.write");
    const input = LinkSchema.parse(raw);

    if (input.gapId === input.dependsOnGapId) {
      throw new MeridianRuleError(
        "gap.self-dependency",
        "Um gap não depende de si mesmo."
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      const gaps = await db.meridianGap.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, code: true },
      });
      const byId = new Map(gaps.map((g) => [g.id, g.code]));
      const from = byId.get(input.gapId);
      const to = byId.get(input.dependsOnGapId);
      if (!(from && to)) {
        throw new MeridianRuleError(
          "gap.not-found",
          "Gap não encontrado nesta organização."
        );
      }

      const existing = await db.meridianGapDependency.findMany({
        where: { tenantId: ctx.tenantId },
        select: { gapId: true, dependsOnGapId: true },
      });
      const edges = existing
        .map((e) => ({
          from: byId.get(e.gapId) ?? "",
          to: byId.get(e.dependsOnGapId) ?? "",
        }))
        .filter((e) => e.from && e.to);
      edges.push({ from, to });

      const cycle = detectCycle(edges);
      if (cycle) {
        throw new MeridianRuleError(
          "gap.cycle",
          `Ciclo de dependências: ${cycle.join(" → ")}`
        );
      }

      await db.meridianGapDependency.create({
        data: {
          tenantId: ctx.tenantId,
          gapId: input.gapId,
          dependsOnGapId: input.dependsOnGapId,
        },
      });
      await logMeridianAudit(db, ctx, {
        action: "meridian.gap.link",
        entityType: "meridian.gapdependency",
        entityId: input.gapId,
        target: `${from} depende de ${to}`,
      });
    });

    revalidatePath("/meridian");
  });
}

export async function unlinkGapDependency(
  raw: z.input<typeof LinkSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.write");
    const input = LinkSchema.parse(raw);
    await withTenantDb(ctx.tenantId, async (db) => {
      await db.meridianGapDependency.deleteMany({
        where: {
          tenantId: ctx.tenantId,
          gapId: input.gapId,
          dependsOnGapId: input.dependsOnGapId,
        },
      });
    });
    revalidatePath("/meridian");
  });
}

const PromoteSchema = z.object({
  gapId: cuid,
  targetProduct: z.enum(["COSMOS", "CHARTER", "SIGNAL", "SCAFFOLD"]),
  targetLabel: nnStr,
  targetEntityId: z.string().max(255).optional(),
});

/**
 * Promove o gap a trabalho em outro produto.
 *
 * O gap **continua sendo do Meridian**: a promoção é linha própria, o estado
 * vira PROMOTED, e nada em `MeridianGap` passa a ser editável de fora. Para
 * Scaffold e Signal, que ainda não existem no repositório, a promoção fica
 * registrada com `targetEntityId` nulo — melhor um vínculo declarado como
 * pendente do que um stub que finge que o trabalho existe.
 */
export async function promoteGap(
  raw: z.input<typeof PromoteSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.promote");
    const input = PromoteSchema.parse(raw);

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const gap = await db.meridianGap.findFirst({
        where: { id: input.gapId, tenantId: ctx.tenantId },
        select: { id: true, code: true, state: true, statement: true },
      });
      if (!gap) {
        throw new MeridianRuleError(
          "gap.not-found",
          "Gap não encontrado nesta organização."
        );
      }
      const active = await db.meridianGapPromotion.findFirst({
        where: { gapId: gap.id, revokedAt: null },
        select: { id: true },
      });
      if (active) {
        throw new MeridianRuleError(
          "gap.already-promoted",
          `${gap.code} já tem promoção ativa.`
        );
      }

      const promotion = await db.meridianGapPromotion.create({
        data: {
          tenantId: ctx.tenantId,
          gapId: gap.id,
          targetProduct: input.targetProduct,
          targetEntityId: input.targetEntityId ?? null,
          targetLabel: input.targetLabel,
          promotedById: ctx.userId,
        },
        select: { id: true },
      });
      await db.meridianGap.update({
        where: { id: gap.id },
        data: { state: "PROMOTED" },
      });
      await logMeridianAudit(db, ctx, {
        action: "meridian.gap.promote",
        entityType: "meridian.promotion",
        entityId: promotion.id,
        target: `${gap.code} → ${input.targetProduct} · ${input.targetLabel}`,
        note: "A posse do gap permanece no Meridian.",
        diff: [["Estado", gap.state, "PROMOTED"]],
      });
      return promotion;
    });

    revalidatePath("/meridian");
    return created;
  });
}

const RevokeSchema = z.object({ promotionId: cuid });

/**
 * Destino removido no outro produto → gap volta ao estado anterior e o custo
 * de atraso volta a correr. A linha da promoção fica: ela aconteceu.
 *
 * Recusa quando `targetEntityId` não é nulo — a promoção já aterrissou num
 * `Engagement` do back-office (ADR-0014). `apps/app` não pode enxergar o
 * `Engagement`, que vive no tenant de sistema; a checagem funciona porque
 * `targetEntityId` é gravado na própria `MeridianGapPromotion`, aqui dentro do
 * tenant do cliente, então não há travessia nenhuma — só um campo que já
 * existe na linha que a query buscou.
 *
 * Limitação registrada, não resolvida aqui: `targetEntityId` só diz que existe
 * um `Engagement`, não se ele está ativo ou já concluído — um engajamento
 * concluído também bloqueia a revogação. Se isso incomodar, quem resolve é o
 * back-office limpando `targetEntityId` ao concluir o engajamento, não
 * `apps/app` tentando enxergar o status de uma entidade que não é dele.
 */
export async function revokePromotion(
  raw: z.input<typeof RevokeSchema>
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireMeridianPermissionContext("gap.promote");
    const input = RevokeSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const p = await db.meridianGapPromotion.findFirst({
        where: { id: input.promotionId, tenantId: ctx.tenantId },
        include: { gap: { select: { id: true, code: true } } },
      });
      if (!p) {
        throw new MeridianRuleError(
          "promotion.not-found",
          "Promoção não encontrada nesta organização."
        );
      }
      // Promoção que já aterrissou em algum lugar não se revoga em silêncio:
      // revogar aqui deixaria trabalho em curso sem origem. Duas regras, e a
      // diferença entre elas é o que `apps/app` consegue enxergar.
      //
      // Trilha do Scaffold vive no tenant do cliente, então dá para perguntar
      // se ela ainda está em curso — e só bloquear nesse caso. Trilha cancelada
      // não precisa segurar a revogação.
      //
      // Engagement vive no tenant de sistema e `apps/app` não o enxerga
      // (ADR-0014). Sem poder ler o status, o único caminho honesto é recusar:
      // `targetEntityId` diz que existe, não se está ativo. Quem destrava é o
      // back-office limpando o campo ao encerrar, não este app tentando espiar
      // entidade que não é dele.
      if (p.targetEntityId) {
        if (p.targetProduct === "SCAFFOLD") {
          const track = await db.scaffoldTrack.findFirst({
            where: {
              id: p.targetEntityId,
              tenantId: ctx.tenantId,
              status: { in: ["ACTIVE", "STALLED"] },
            },
            select: { code: true },
          });
          if (track) {
            throw new MeridianRuleError(
              "promotion.has-active-track",
              `${p.gap.code} tem a trilha ${track.code} em curso no Scaffold. Cancele a trilha antes de revogar a promoção.`
            );
          }
        } else {
          throw new MeridianRuleError(
            "promotion.materialized",
            `${p.gap.code} já foi materializado em um Engagement no back-office — revogar aqui deixaria o engajamento sem a promoção que o originou. Encerre o engajamento no back-office antes de revogar.`
          );
        }
      }

      await db.meridianGapPromotion.update({
        where: { id: p.id },
        data: { revokedAt: new Date() },
      });
      const planned = await db.meridianPlanItem.findFirst({
        where: { tenantId: ctx.tenantId, gapId: p.gap.id },
        select: { id: true },
      });
      const back: MeridianGapState = planned ? "PLANNED" : "OPEN";
      await db.meridianGap.update({
        where: { id: p.gap.id },
        data: { state: back },
      });
      await logMeridianAudit(db, ctx, {
        action: "meridian.gap.promotion-revoke",
        entityType: "meridian.promotion",
        entityId: p.id,
        target: p.gap.code,
        diff: [["Estado", "PROMOTED", back]],
      });
    });

    revalidatePath("/meridian");
  });
}
