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
  // Derived from BillingEntryAllocation, same normalization getTheme() uses
  // for a single theme (see below) — null only when the tenant has no
  // themed allocation data at all yet, never fabricated.
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
    const [rows, allocations] = await Promise.all([
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
      // Same tenant-scoped BillingEntryAllocation aggregation getTheme()
      // performs for one theme, batched across every theme at once: each
      // theme's actual cost, normalized against the sum across every themed
      // allocation in the tenant.
      database.billingEntryAllocation.findMany({
        where: { tenantId: ctx.tenantId, themeId: { not: null } },
        select: {
          themeId: true,
          percentage: true,
          billingEntry: { select: { effectiveCost: true } },
        },
      }),
    ]);

    const costByTheme = new Map<string, number>();
    let totalCost = 0;
    for (const a of allocations) {
      const cost =
        (Number(a.percentage) / 100) * Number(a.billingEntry.effectiveCost);
      totalCost += cost;
      if (a.themeId) {
        costByTheme.set(a.themeId, (costByTheme.get(a.themeId) ?? 0) + cost);
      }
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
  // Derived from BillingEntryAllocation (percentage-based cost attribution,
  // finops.prisma). null when the tenant has no allocation data at all yet —
  // never fabricated, never defaulted to 0.
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

    // Real allocation: sum(billingEntry.effectiveCost * percentage/100) for
    // this theme's allocations, normalized against the same sum across every
    // themed allocation in the tenant — comparable to targetAllocationPct,
    // which is also a % of total portfolio investment.
    const [themeAllocations, allThemeAllocations] = await Promise.all([
      database.billingEntryAllocation.findMany({
        where: { tenantId: ctx.tenantId, themeId: id },
        select: {
          percentage: true,
          billingEntry: { select: { effectiveCost: true } },
        },
      }),
      database.billingEntryAllocation.findMany({
        where: { tenantId: ctx.tenantId, themeId: { not: null } },
        select: {
          percentage: true,
          billingEntry: { select: { effectiveCost: true } },
        },
      }),
    ]);
    const sumCost = (
      rows: { percentage: unknown; billingEntry: { effectiveCost: unknown } }[]
    ) =>
      rows.reduce(
        (sum, a) =>
          sum +
          (Number(a.percentage) / 100) * Number(a.billingEntry.effectiveCost),
        0
      );
    const themeCost = sumCost(themeAllocations);
    const totalCost = sumCost(allThemeAllocations);
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

/** Tones do design, na ordem do TonePicker. StrategicTheme.color guarda hex
 *  desde antes desta tela, então o token vira hex na escrita — quem lê a cor
 *  como hex continua funcionando. */
const TONE_HEX: Record<string, string> = {
  accent: "#6366f1",
  blue: "#38bdf8",
  purple: "#a78bfa",
  green: "#34d399",
  amber: "#fbbf24",
  red: "#fb7185",
};

const CreateThemeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  // "Investment amount" — see StrategicTheme.budgetTotal in schema.
  budgetTotal: z.number().nonnegative().optional(),
  /** Token de cor do TonePicker. */
  tone: z
    .enum(["accent", "blue", "purple", "green", "amber", "red"])
    .optional(),
  /** Fatia do lean budget do portfólio que esta aposta deveria consumir. */
  targetAllocationPct: z.number().min(0).max(100).optional(),
  /** Value Stream que banca o tema. LeanBudget.themeId é o lado que aponta,
   *  então vincular é atualizar o budget escolhido. */
  leanBudgetId: z.string().cuid().optional(),
  /** Épicos que compõem o tema — Epic.strategicThemeId. */
  epicIds: z.array(z.string().cuid()).optional(),
});

export async function createTheme(
  input: z.input<typeof CreateThemeSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const {
      title,
      description,
      budgetTotal,
      tone,
      targetAllocationPct,
      leanBudgetId,
      epicIds,
    } = CreateThemeSchema.parse(input);

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

    // Guardas cross-tenant ANTES de criar: um id de outro tenant vindo do
    // cliente não pode virar vínculo, e falhar depois de criar deixaria um
    // tema órfão pela metade.
    if (leanBudgetId) {
      const budget = await database.leanBudget.findFirst({
        where: { id: leanBudgetId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!budget) {
        throw new Error("Budget não encontrado neste workspace.");
      }
    }
    if (epicIds && epicIds.length > 0) {
      const encontrados = await database.epic.count({
        where: { id: { in: epicIds }, tenantId: ctx.tenantId },
      });
      if (encontrados !== epicIds.length) {
        throw new Error("Épico não encontrado neste workspace.");
      }
    }

    const created = await database.strategicTheme.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        description: description ?? null,
        budgetTotal: budgetTotal ?? null,
        ...(tone ? { color: TONE_HEX[tone] ?? TONE_HEX.accent } : {}),
        ...(targetAllocationPct !== undefined ? { targetAllocationPct } : {}),
      },
      select: { id: true },
    });

    // Os vínculos moram no outro lado da relação: o budget aponta para o tema
    // (LeanBudget.themeId) e cada épico aponta para o tema
    // (Epic.strategicThemeId). Sem isto o tema nasce sem dinheiro e sem
    // escopo — que é o estado em que a tela antiga deixava todos eles.
    if (leanBudgetId) {
      await database.leanBudget.update({
        where: { id: leanBudgetId },
        data: { themeId: created.id },
      });
    }
    if (epicIds && epicIds.length > 0) {
      await database.epic.updateMany({
        where: { id: { in: epicIds }, tenantId: ctx.tenantId },
        data: { strategicThemeId: created.id },
      });
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "theme",
      entityId: created.id,
      diff: {
        title,
        ...(leanBudgetId ? { leanBudgetId } : {}),
        ...(epicIds?.length ? { epicIds } : {}),
      },
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

// ─── Opções de vínculo do modal de tema ──────────────────────────────────────

export type ThemeLinkOption = {
  id: string;
  label: string;
  /** Linha de apoio no dropdown — o que ajuda a escolher sem sair da tela. */
  sub: string;
  /** Só para budgets: alimenta a barra de alocado × alvo no preview. */
  amount?: number;
};

export type ThemeLinkOptions = {
  budgets: ThemeLinkOption[];
  epics: ThemeLinkOption[];
  /** Soma dos lean budgets do portfólio — denominador do "% alocado". */
  budgetTotalPortfolio: number;
};

/**
 * Budgets e épicos que o modal de tema pode vincular.
 *
 * Uma viagem só: os dois campos de busca abrem juntos, e duas actions
 * separadas fariam a tela piscar em ordens diferentes a cada abertura. Só
 * traz o que é vinculável — budget já tomado por outro tema e épico já
 * ligado a um tema ficam de fora, porque oferecê-los seria oferecer um
 * roubo silencioso de vínculo.
 */
export async function listThemeLinkOptions(): Promise<
  Result<ThemeLinkOptions>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const [budgets, epics, todosOsBudgets] = await Promise.all([
      database.leanBudget.findMany({
        where: { tenantId: ctx.tenantId, themeId: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, amount: true, period: true },
      }),
      database.epic.findMany({
        where: { tenantId: ctx.tenantId, strategicThemeId: null },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { id: true, title: true, lifecycleStatus: true },
      }),
      database.leanBudget.findMany({
        where: { tenantId: ctx.tenantId },
        select: { amount: true },
      }),
    ]);

    return {
      budgets: budgets.map((b) => ({
        id: b.id,
        label: b.name,
        sub: `${formatBRL(b.amount)} · ${b.period}`,
        amount: b.amount,
      })),
      epics: epics.map((e) => ({
        id: e.id,
        label: e.title,
        sub: e.lifecycleStatus,
      })),
      budgetTotalPortfolio: todosOsBudgets.reduce((s, b) => s + b.amount, 0),
    };
  });
}

function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(valor);
}
