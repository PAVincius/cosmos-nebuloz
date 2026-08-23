"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import {
  ARCHIVED_THEME_STATUS,
  MAX_ACTIVE_THEMES,
  THEME_CONCENTRATION_THRESHOLD_PCT,
} from "./themes.constants";

export type ThemeView = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  healthStatus: string;
  status: string;
  targetAllocationPct: number | null;
  // Derived from BillingEntry.themeId + effectiveCost (the only path that has
  // a production writer — see NEB-185), same normalization getTheme() uses
  // for a single theme (see below) — null only when the tenant has no
  // themed cost data at all yet, never fabricated.
  actualAllocationPct: number | null;
  horizon: string | null;
  epicCount: number;
  avgProgress: number;
  // Fatia dos épicos do portfólio ativo sob este tema. null (nunca 0) quando
  // não há épico algum sob tema ativo, ou quando o próprio tema está
  // arquivado — não se infere concentração de denominador zero.
  epicSharePct: number | null;
  overConcentrated: boolean;
};

export async function listThemes(): Promise<Result<ThemeView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const [rows, costGroups] = await Promise.all([
      database.strategicTheme.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          color: true,
          healthStatus: true,
          status: true,
          targetAllocationPct: true,
          horizon: true,
          epics: { select: { featureCount: true, doneFeatureCount: true } },
        },
      }),
      // Same tenant-scoped BillingEntry aggregation getTheme() performs for
      // one theme, batched across every theme at once: each theme's cost,
      // normalized against the sum across every themed BillingEntry in the
      // tenant. BillingEntryAllocation has no production writer (NEB-185) —
      // this is the path that actually has data.
      database.billingEntry.groupBy({
        by: ["themeId"],
        where: { tenantId: ctx.tenantId, themeId: { not: null } },
        _sum: { effectiveCost: true },
      }),
    ]);

    const costByTheme = new Map<string, number>();
    let totalCost = 0;
    for (const g of costGroups) {
      if (!g.themeId) {
        continue;
      }
      const cost = Number(g._sum.effectiveCost ?? 0);
      totalCost += cost;
      costByTheme.set(g.themeId, cost);
    }

    // Denominador da concentração: épicos sob temas ATIVOS. Um tema arquivado
    // guarda seus épicos por fidelidade histórica, mas não disputa mais
    // investimento — contá-lo diluiria a concentração e o alerta nunca
    // dispararia depois de um arquivamento.
    const activeEpicTotal = rows
      .filter((t) => t.status !== ARCHIVED_THEME_STATUS)
      .reduce((sum, t) => sum + t.epics.length, 0);

    return rows.map((t) => {
      const withFeatures = t.epics.filter((e) => e.featureCount > 0);
      const avgProgress = withFeatures.length
        ? Math.round(
            withFeatures.reduce(
              (s, e) => s + (e.doneFeatureCount / e.featureCount) * 100,
              0
            ) / withFeatures.length
          )
        : 0;
      const actualAllocationPct =
        totalCost > 0
          ? Math.round(((costByTheme.get(t.id) ?? 0) / totalCost) * 1000) / 10
          : null;
      const epicSharePct =
        t.status === ARCHIVED_THEME_STATUS || activeEpicTotal === 0
          ? null
          : Math.round((t.epics.length / activeEpicTotal) * 1000) / 10;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        color: t.color,
        healthStatus: t.healthStatus,
        status: t.status,
        targetAllocationPct: t.targetAllocationPct,
        actualAllocationPct,
        horizon: t.horizon,
        epicCount: t.epics.length,
        avgProgress,
        epicSharePct,
        overConcentrated:
          epicSharePct !== null &&
          epicSharePct > THEME_CONCENTRATION_THRESHOLD_PCT,
      };
    });
  });
}

export type ThemeDetailView = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  healthStatus: string;
  horizon: string | null;
  targetAllocationPct: number | null;
  // Derived from BillingEntry.themeId + effectiveCost (finops.prisma) — the
  // only path with a production writer (NEB-185). null when the tenant has
  // no themed cost data at all yet — never fabricated, never defaulted to 0.
  actualAllocationPct: number | null;
  pillar: { id: string; name: string } | null;
  epics: {
    id: string;
    title: string;
    statusId: string;
    lifecycleStatus: string;
    wsjf: number | null;
    progressPct: number;
  }[];
  avgProgress: number;
};

export async function getTheme(id: string): Promise<Result<ThemeDetailView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const theme = await database.strategicTheme.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        description: true,
        color: true,
        healthStatus: true,
        horizon: true,
        targetAllocationPct: true,
        pillar: { select: { id: true, name: true } },
        epics: {
          select: {
            id: true,
            title: true,
            statusId: true,
            lifecycleStatus: true,
            wsjf: true,
            featureCount: true,
            doneFeatureCount: true,
          },
        },
      },
    });

    if (!theme) {
      throw new Error("Tema estratégico não encontrado.");
    }

    const epics = theme.epics.map((e) => ({
      id: e.id,
      title: e.title,
      statusId: e.statusId,
      lifecycleStatus: e.lifecycleStatus,
      wsjf: e.wsjf,
      progressPct:
        e.featureCount > 0
          ? Math.round((e.doneFeatureCount / e.featureCount) * 100)
          : 0,
    }));
    const withFeatures = theme.epics.filter((e) => e.featureCount > 0);
    const avgProgress = withFeatures.length
      ? Math.round(
          withFeatures.reduce(
            (s, e) => s + (e.doneFeatureCount / e.featureCount) * 100,
            0
          ) / withFeatures.length
        )
      : 0;

    // Real allocation: sum(BillingEntry.effectiveCost) for this theme,
    // normalized against the same sum across every themed BillingEntry in
    // the tenant — comparable to targetAllocationPct, which is also a % of
    // total portfolio investment. BillingEntryAllocation has no production
    // writer (NEB-185) — this is the path that actually has data.
    const [themeCostAgg, totalCostAgg] = await Promise.all([
      database.billingEntry.aggregate({
        where: { tenantId: ctx.tenantId, themeId: id },
        _sum: { effectiveCost: true },
      }),
      database.billingEntry.aggregate({
        where: { tenantId: ctx.tenantId, themeId: { not: null } },
        _sum: { effectiveCost: true },
      }),
    ]);
    const themeCost = Number(themeCostAgg._sum.effectiveCost ?? 0);
    const totalCost = Number(totalCostAgg._sum.effectiveCost ?? 0);
    const actualAllocationPct =
      totalCost > 0 ? Math.round((themeCost / totalCost) * 1000) / 10 : null;

    return {
      id: theme.id,
      title: theme.title,
      description: theme.description,
      color: theme.color,
      healthStatus: theme.healthStatus,
      horizon: theme.horizon,
      targetAllocationPct: theme.targetAllocationPct,
      actualAllocationPct,
      pillar: theme.pillar,
      epics,
      avgProgress,
    };
  });
}

const CreateThemeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  // "Investment amount" — see StrategicTheme.budgetTotal in schema.
  budgetTotal: z.number().nonnegative().optional(),
});

export async function createTheme(
  input: z.input<typeof CreateThemeSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { title, description, budgetTotal } = CreateThemeSchema.parse(input);

    // Teto SAFe de temas ativos. Conta status, não linha: tema arquivado
    // continua na tabela por fidelidade histórica e não ocupa vaga.
    const activeCount = await database.strategicTheme.count({
      where: {
        tenantId: ctx.tenantId,
        status: { not: ARCHIVED_THEME_STATUS },
      },
    });
    if (activeCount >= MAX_ACTIVE_THEMES) {
      throw new Error(
        `Limite de ${MAX_ACTIVE_THEMES} temas estratégicos ativos atingido. Arquive um tema antes de criar outro.`
      );
    }

    const created = await database.strategicTheme.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        description: description ?? null,
        budgetTotal: budgetTotal ?? null,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "theme",
      entityId: created.id,
      diff: { title },
    });
    revalidateTag(`themes:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

const ArchiveThemeSchema = z.object({ id: z.string().min(1) });

/**
 * Arquiva um tema estratégico. Não-cascateante por definição (FR-014, UC-62):
 * nenhum Epic é tocado — os épicos que rodaram sob o tema continuam apontando
 * para ele, senão o histórico de investimento do portfólio some junto.
 * O alvo de alocação é zerado porque alvo é atributo de tema ativo: deixá-lo
 * pendurado quebraria a soma de 100% do rebalanceamento.
 */
export async function archiveTheme(
  input: z.input<typeof ArchiveThemeSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { id } = ArchiveThemeSchema.parse(input);

    // IDOR guard — id vem do cliente, então a existência é confirmada dentro
    // do tenant antes de qualquer escrita.
    const existing = await database.strategicTheme.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new Error("Tema estratégico não encontrado.");
    }
    if (existing.status === ARCHIVED_THEME_STATUS) {
      throw new Error("Este tema estratégico já está arquivado.");
    }

    await database.strategicTheme.update({
      where: { id },
      data: { status: ARCHIVED_THEME_STATUS, targetAllocationPct: null },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "theme",
      entityId: id,
      diff: { from: existing.status, to: ARCHIVED_THEME_STATUS },
    });
    revalidateTag(`themes:${ctx.tenantId}`, "max");
    return { id };
  });
}

const RebalanceTargetSchema = z.object({
  themeId: z.string().min(1),
  targetAllocationPct: z.number().finite().min(0).max(100),
});

const RebalanceThemeTargetsSchema = z
  .object({
    targets: z.array(RebalanceTargetSchema).min(1),
  })
  .refine(
    (v) => new Set(v.targets.map((t) => t.themeId)).size === v.targets.length,
    {
      message: "IDs de tema duplicados na requisição.",
      path: ["targets"],
    }
  )
  .refine(
    (v) =>
      Math.abs(
        v.targets.reduce((sum, t) => sum + t.targetAllocationPct, 0) - 100
      ) < 0.01,
    {
      message: "A soma das alocações deve ser 100%.",
      path: ["targets"],
    }
  );

export async function rebalanceThemeTargets(
  input: z.input<typeof RebalanceThemeTargetsSchema>
): Promise<Result<{ count: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { targets } = RebalanceThemeTargetsSchema.parse(input);
    const themeIds = targets.map((t) => t.themeId);

    // IDOR guard — every themeId must belong to this tenant. Never update by
    // id alone: fetch by id+tenantId and assert the count matches.
    const owned = await database.strategicTheme.findMany({
      where: { id: { in: themeIds }, tenantId: ctx.tenantId },
      select: { id: true, targetAllocationPct: true, status: true },
    });
    if (owned.length !== themeIds.length) {
      throw new Error("Um ou mais temas não pertencem a este tenant.");
    }
    // Tema arquivado não recebe investimento. Aceitá-lo faria a soma de 100%
    // cobrir tema fora do portfólio ativo, e o Strategy Map passaria a mentir.
    if (owned.some((t) => t.status === ARCHIVED_THEME_STATUS)) {
      throw new Error(
        "Tema arquivado não recebe alocação-alvo. Remova-o do rebalanceamento."
      );
    }

    const before = new Map(owned.map((t) => [t.id, t.targetAllocationPct]));

    // Atomic batch — a partial rebalance must never persist. updateMany can't
    // set different values per row, so this is an array of updates inside a
    // single $transaction.
    await database.$transaction(
      targets.map((t) =>
        database.strategicTheme.update({
          where: { id: t.themeId },
          data: { targetAllocationPct: t.targetAllocationPct },
        })
      )
    );

    // One audit row per theme — entityId must be that theme's own cuid so
    // getAuditLogsByEntity (exact-equality lookup) can find it.
    await Promise.all(
      targets.map((t) =>
        logAudit(ctx.tenantId, {
          userId: ctx.userId,
          action: "updated",
          entityType: "theme",
          entityId: t.themeId,
          diff: {
            from: String(before.get(t.themeId) ?? 0),
            to: String(t.targetAllocationPct),
          },
        })
      )
    );
    revalidateTag(`themes:${ctx.tenantId}`, "max");
    return { count: targets.length };
  });
}
