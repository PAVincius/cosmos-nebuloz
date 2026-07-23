"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type ThemeView = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  healthStatus: string;
  targetAllocationPct: number | null;
  horizon: string | null;
  epicCount: number;
  avgProgress: number;
};

export async function listThemes(): Promise<Result<ThemeView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.strategicTheme.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        color: true,
        healthStatus: true,
        // Simplification (Tier 1, documented): targetAllocationPct is used
        // as-is; a real "current allocation" aggregate is not yet materialized.
        targetAllocationPct: true,
        horizon: true,
        epics: { select: { featureCount: true, doneFeatureCount: true } },
      },
    });

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
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        color: t.color,
        healthStatus: t.healthStatus,
        targetAllocationPct: t.targetAllocationPct,
        horizon: t.horizon,
        epicCount: t.epics.length,
        avgProgress,
      };
    });
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

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "theme",
      entityId: themeIds.join(","),
      diff: Object.fromEntries(
        targets.map((t) => [
          t.themeId,
          `${before.get(t.themeId) ?? 0}→${t.targetAllocationPct}`,
        ])
      ),
    });
    revalidateTag(`themes:${ctx.tenantId}`, "max");
    return { count: targets.length };
  });
}
