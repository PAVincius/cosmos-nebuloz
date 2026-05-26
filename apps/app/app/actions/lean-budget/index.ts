"use server";

import { requireTenantSession } from "@repo/auth/server";
import type { LeanBudget } from "@repo/database";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type Result, safeAction } from "@/app/actions/_base";
import {
  type CreateBudgetInput,
  CreateBudgetSchema,
  type GuardrailsInput,
  type LeanBudgetWithStats,
  type LeanBudgetWithUsage,
  type UpdateBudgetInput,
  UpdateBudgetSchema,
  UpdateSpentSchema,
} from "./schema";

export type {
  CreateBudgetInput,
  UpdateBudgetInput,
  GuardrailsInput,
  LeanBudgetWithStats,
  LeanBudgetWithUsage,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withStats(b: LeanBudget): LeanBudgetWithStats {
  // Use spentDecimal (Decimal) with fallback to spent (Float) during migration
  const spentValue =
    b.spentDecimal !== null && b.spentDecimal !== undefined
      ? Number(b.spentDecimal)
      : b.spent;
  const pct = b.amount > 0 ? (spentValue / b.amount) * 100 : 0;
  const g = b.guardrails as { capex?: number; opex?: number } | null;
  return {
    ...b,
    percentUsed: Math.round(pct * 10) / 10,
    isOverBudget: spentValue > b.amount,
    isNearLimit: pct > 80,
    capexRemaining:
      g?.capex !== undefined ? g.capex - spentValue * 0.5 : undefined,
    opexRemaining:
      g?.opex !== undefined ? g.opex - spentValue * 0.5 : undefined,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listBudgetsByTheme(
  themeId: string
): Promise<Result<LeanBudgetWithStats[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const budgets = await database.leanBudget.findMany({
      where: { tenantId: ctx.tenantId, themeId },
      orderBy: [{ period: "desc" }, { name: "asc" }],
    });
    return budgets.map(withStats);
  });
}

export async function linkBudgetToTheme(
  budgetId: string,
  themeId: string | null
): Promise<Result<LeanBudget>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { count } = await database.leanBudget.updateMany({
      where: { id: budgetId, tenantId: ctx.tenantId },
      data: { themeId: themeId ?? null },
    });
    if (count === 0) throw new Error("Budget não encontrado ou sem permissão.");
    const updated = await database.leanBudget.findFirstOrThrow({
      where: { id: budgetId, tenantId: ctx.tenantId },
    });
    revalidatePath("/portfolio/budgets");
    if (themeId) revalidatePath(`/portfolio/themes/${themeId}`);
    return updated;
  });
}

export async function listLeanBudgets(): Promise<
  Result<LeanBudgetWithStats[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const budgets = await database.leanBudget.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ period: "desc" }, { name: "asc" }],
    });
    return budgets.map(withStats);
  });
}

export async function getLeanBudgetById(
  id: string
): Promise<Result<LeanBudgetWithStats>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const budget = await database.leanBudget.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!budget) throw new Error("Orçamento não encontrado.");
    return withStats(budget);
  });
}

export async function getBudgetSummary(): Promise<
  Result<{
    totalBudget: number;
    totalSpent: number;
    byPeriod: Record<string, { budget: number; spent: number }>;
  }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const budgets = await database.leanBudget.findMany({
      where: { tenantId: ctx.tenantId },
      select: { amount: true, spent: true, period: true },
    });

    const byPeriod: Record<string, { budget: number; spent: number }> = {};
    let totalBudget = 0;
    let totalSpent = 0;

    for (const b of budgets) {
      totalBudget += b.amount;
      totalSpent += b.spent;

      if (!byPeriod[b.period]) {
        byPeriod[b.period] = { budget: 0, spent: 0 };
      }
      byPeriod[b.period].budget += b.amount;
      byPeriod[b.period].spent += b.spent;
    }

    return { totalBudget, totalSpent, byPeriod };
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createLeanBudget(
  raw: unknown
): Promise<Result<LeanBudget>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = CreateBudgetSchema.parse(raw);

    const budget = await database.leanBudget.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        amount: input.amount,
        spent: input.spent,
        spentDecimal: String(input.spent),
        period: input.period,
        artId: input.artId ?? null,
        themeId: input.themeId ?? null,
        guardrails: input.guardrails ?? undefined,
      },
    });

    revalidatePath("/portfolio/budgets");
    revalidatePath("/portfolio");
    if (input.themeId) revalidatePath(`/portfolio/themes/${input.themeId}`);
    return budget;
  });
}

export async function updateLeanBudget(
  id: string,
  raw: unknown
): Promise<Result<LeanBudget>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateBudgetSchema.parse(raw);

    const { count } = await database.leanBudget.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.spent !== undefined && {
          spent: input.spent,
          spentDecimal: String(input.spent),
        }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.guardrails !== undefined && {
          guardrails: input.guardrails ?? undefined,
        }),
      },
    });

    if (count === 0)
      throw new Error("Orçamento não encontrado ou sem permissão.");

    const updated = await database.leanBudget.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/budgets");
    revalidatePath("/portfolio");
    return updated;
  });
}

export async function updateSpent(
  id: string,
  raw: unknown
): Promise<Result<LeanBudget>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = UpdateSpentSchema.parse(raw);

    const { count } = await database.leanBudget.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: { spent: input.spent, spentDecimal: String(input.spent) },
    });

    if (count === 0)
      throw new Error("Orçamento não encontrado ou sem permissão.");

    const updated = await database.leanBudget.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/budgets");
    revalidatePath("/portfolio");
    return updated;
  });
}

export async function deleteLeanBudget(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const { count } = await database.leanBudget.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });

    if (count === 0)
      throw new Error("Orçamento não encontrado ou sem permissão.");

    revalidatePath("/portfolio/budgets");
    revalidatePath("/portfolio");
    return { id };
  });
}

export async function getBudgetById(
  id: string
): Promise<Result<LeanBudgetWithStats | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const b = await database.leanBudget.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    return b ? withStats(b) : null;
  });
}

// ─── Backward-compatible helpers (for existing UI components) ─────────────────

/** @deprecated use listLeanBudgets */
export async function getLeanBudgets(): Promise<LeanBudgetWithUsage[]> {
  const result = await listLeanBudgets();
  if (!result.ok) throw new Error(result.error);
  return result.data.map((b) => {
    const g = b.guardrails as { capex?: number; opex?: number } | null;
    return {
      ...b,
      isOverGuardrail: b.isNearLimit,
      guardrails:
        g?.capex !== undefined && g?.opex !== undefined
          ? { capex: g.capex, opex: g.opex }
          : null,
    };
  });
}
