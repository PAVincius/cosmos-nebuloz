"use server";

import { requireTenantSession } from "@repo/auth/server";
import type { LeanBudget } from "@repo/database";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { type Result, safeAction } from "@/app/actions/_base";
import { logAudit } from "@/app/actions/audit/log-audit";
import { enforce } from "@/app/actions/permissions";
import {
  CreateBudgetSchema,
  type LeanBudgetWithStats,
  type LeanBudgetWithUsage,
  UpdateBudgetSchema,
  UpdateSpentSchema,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Porta única de escrita: confirma o tenant e recusa orçamento já congelado.
 *
 * `immutableAt` passou a ser gravado no fecho do PI (story-017 AC-005,
 * `lockLeanBudgets` em app/actions/arts/lifecycle.ts). Sem esta checagem o
 * carimbo seria decorativo — o PI fecharia "congelando" o orçamento e qualquer
 * mutação seguiria escrevendo por cima, que é justamente o que o Lean Budget
 * Guardrail do SAFe existe para impedir: o gasto de um PI encerrado não se
 * reescreve depois do fato.
 *
 * Devolve o registro para quem chamou poder auditar o estado anterior.
 */
async function carregarEditavel(tenantId: string, id: string) {
  const budget = await database.leanBudget.findFirst({
    where: { id, tenantId },
    select: { id: true, name: true, immutableAt: true },
  });
  if (!budget) {
    throw new Error("Orçamento não encontrado.");
  }
  if (budget.immutableAt) {
    throw new Error(
      `BUDGET_IMMUTABLE: congelado no fecho do PI em ${budget.immutableAt.toISOString()}.`
    );
  }
  return budget;
}

function withStats(b: LeanBudget): LeanBudgetWithStats {
  const spentDecimal = b.spent !== null ? Number(b.spent) : null;
  const spentManualOverride =
    b.spentManualOverride !== null ? Number(b.spentManualOverride) : null;
  const spentValue = spentDecimal ?? 0;
  const pct = b.amount > 0 ? (spentValue / b.amount) * 100 : 0;
  const g = b.guardrails as { capex?: number; opex?: number } | null;
  return {
    ...b,
    spentDecimal,
    spentManualOverride,
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

async function listBudgetsByTheme(
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
    enforce(ctx.role, "LeanBudget", "update");
    await carregarEditavel(ctx.tenantId, budgetId);

    // themeId vem do cliente. null é desvincular — não há FK para conferir.
    if (themeId) {
      const theme = await database.strategicTheme.findFirst({
        where: { id: themeId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!theme) {
        throw new Error("Tema estratégico inválido.");
      }
    }

    const { count } = await database.leanBudget.updateMany({
      where: { id: budgetId, tenantId: ctx.tenantId },
      data: { themeId: themeId ?? null },
    });
    if (count === 0) {
      throw new Error("Budget não encontrado ou sem permissão.");
    }
    const updated = await database.leanBudget.findFirstOrThrow({
      where: { id: budgetId, tenantId: ctx.tenantId },
    });
    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "lean_budget",
      entityId: budgetId,
      diff: { themeId: themeId ?? "(desvinculado)" },
    });

    revalidatePath("/cosmos/budgets");
    if (themeId) {
      revalidatePath(`/cosmos/theme/${themeId}`);
    }
    return updated;
  });
}

async function listLeanBudgets(): Promise<Result<LeanBudgetWithStats[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const budgets = await database.leanBudget.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ period: "desc" }, { name: "asc" }],
    });
    return budgets.map(withStats);
  });
}

async function getLeanBudgetById(
  id: string
): Promise<Result<LeanBudgetWithStats>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const budget = await database.leanBudget.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!budget) {
      throw new Error("Orçamento não encontrado.");
    }
    return withStats(budget);
  });
}

async function getBudgetSummary(): Promise<
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
      const spentNum = Number(b.spent ?? 0);
      totalBudget += b.amount;
      totalSpent += spentNum;

      if (!byPeriod[b.period]) {
        byPeriod[b.period] = { budget: 0, spent: 0 };
      }
      byPeriod[b.period].budget += b.amount;
      byPeriod[b.period].spent += spentNum;
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
    // Esta ação nasceu sem guard nenhum e sobreviveu assim porque não tinha
    // chamador. Ao virar superfície de escrita na tela de budgets (story-062)
    // ela passa a precisar do mesmo trio do resto do repo: papel, IDOR nos FKs
    // que vêm do cliente, e auditoria — orçamento é dinheiro.
    enforce(ctx.role, "LeanBudget", "create");
    const input = CreateBudgetSchema.parse(raw);

    // artId e themeId chegam do cliente: sem esta confirmação um tenant
    // penduraria seu orçamento no ART ou no tema de outro.
    if (input.artId) {
      const art = await database.aRT.findFirst({
        where: { id: input.artId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!art) {
        throw new Error("ART inválido.");
      }
    }
    if (input.themeId) {
      const theme = await database.strategicTheme.findFirst({
        where: { id: input.themeId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!theme) {
        throw new Error("Tema estratégico inválido.");
      }
    }

    const budget = await database.leanBudget.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        amount: input.amount,
        spent: String(input.spent),
        period: input.period,
        artId: input.artId ?? null,
        themeId: input.themeId ?? null,
        guardrails: input.guardrails ?? undefined,
      },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "lean_budget",
      entityId: budget.id,
      diff: {
        name: input.name,
        amount: String(input.amount),
        period: input.period,
      },
    });

    revalidatePath("/cosmos/budgets");
    if (input.themeId) {
      revalidatePath(`/cosmos/theme/${input.themeId}`);
    }
    return budget;
  });
}

export async function updateLeanBudget(
  id: string,
  raw: unknown
): Promise<Result<LeanBudget>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "LeanBudget", "update");
    const input = UpdateBudgetSchema.parse(raw);
    await carregarEditavel(ctx.tenantId, id);

    const { count } = await database.leanBudget.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.spent !== undefined && {
          spent: String(input.spent),
        }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.guardrails !== undefined && {
          guardrails: input.guardrails ?? undefined,
        }),
      },
    });

    if (count === 0) {
      throw new Error("Orçamento não encontrado ou sem permissão.");
    }

    const updated = await database.leanBudget.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "lean_budget",
      entityId: id,
      diff: Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, String(v)])
      ),
    });

    revalidatePath("/cosmos/budgets");
    return updated;
  });
}

export async function updateSpent(
  id: string,
  raw: unknown
): Promise<Result<LeanBudget>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "LeanBudget", "update");
    const input = UpdateSpentSchema.parse(raw);
    await carregarEditavel(ctx.tenantId, id);

    const { count } = await database.leanBudget.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: { spent: String(input.spent) },
    });

    if (count === 0) {
      throw new Error("Orçamento não encontrado ou sem permissão.");
    }

    const updated = await database.leanBudget.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "lean_budget",
      entityId: id,
      diff: { spent: String(input.spent) },
    });

    revalidatePath("/cosmos/budgets");
    return updated;
  });
}

export async function deleteLeanBudget(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "LeanBudget", "delete");
    const budget = await carregarEditavel(ctx.tenantId, id);

    const { count } = await database.leanBudget.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });

    if (count === 0) {
      throw new Error("Orçamento não encontrado ou sem permissão.");
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "deleted",
      entityType: "lean_budget",
      entityId: id,
      diff: { name: budget.name },
    });

    revalidatePath("/cosmos/budgets");
    return { id };
  });
}

async function getBudgetById(
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
async function getLeanBudgets(): Promise<LeanBudgetWithUsage[]> {
  const result = await listLeanBudgets();
  if (!result.ok) {
    throw new Error(result.error);
  }
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
