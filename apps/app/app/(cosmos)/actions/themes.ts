"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type ThemeView = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  healthStatus: string;
  targetAllocationPct: number | null;
  // Derived from BillingEntryAllocation, same normalization getTheme() uses
  // for a single theme (see below) — null only when the tenant has no
  // themed allocation data at all yet, never fabricated.
  actualAllocationPct: number | null;
  horizon: string | null;
  epicCount: number;
  avgProgress: number;
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
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        color: t.color,
        healthStatus: t.healthStatus,
        targetAllocationPct: t.targetAllocationPct,
        actualAllocationPct,
        horizon: t.horizon,
        epicCount: t.epics.length,
        avgProgress,
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
      select: { id: true, targetAllocationPct: true },
    });
    if (owned.length !== themeIds.length) {
      throw new Error("Um ou mais temas não pertencem a este tenant.");
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
