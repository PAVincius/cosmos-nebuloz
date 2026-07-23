"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type LeanBudgetView = {
  id: string;
  name: string;
  themeName: string | null;
  amount: number;
  spent: number;
  period: string;
  capexPct: number | null;
  opexPct: number | null;
  spendLimitUsd: number | null;
  approvalThresholdUsd: number | null;
  utilizationPct: number;
};

export async function listLeanBudgets(): Promise<Result<LeanBudgetView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.leanBudget.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { period: "desc" },
      select: {
        id: true,
        name: true,
        amount: true,
        spent: true,
        period: true,
        capexPct: true,
        opexPct: true,
        spendLimitUsd: true,
        approvalThresholdUsd: true,
        strategicTheme: { select: { title: true } },
      },
    });

    return rows.map((b) => {
      const spent = Number(b.spent ?? 0);
      return {
        id: b.id,
        name: b.name,
        themeName: b.strategicTheme?.title ?? null,
        amount: b.amount,
        spent,
        period: b.period,
        capexPct: b.capexPct,
        opexPct: b.opexPct,
        spendLimitUsd: b.spendLimitUsd,
        approvalThresholdUsd: b.approvalThresholdUsd,
        utilizationPct: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    });
  });
}

const UpdateLeanBudgetGuardrailsSchema = z
  .object({
    budgetId: z.string().min(1),
    capexPct: z.number().min(0).max(100),
    opexPct: z.number().min(0).max(100),
    spendLimitUsd: z.number().min(0).optional(),
    approvalThresholdUsd: z.number().min(0).optional(),
  })
  .refine((v) => v.capexPct + v.opexPct === 100, {
    message: "CapEx % + OpEx % devem somar 100.",
    path: ["opexPct"],
  });

export async function updateLeanBudgetGuardrails(
  input: z.input<typeof UpdateLeanBudgetGuardrailsSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { budgetId, capexPct, opexPct, spendLimitUsd, approvalThresholdUsd } =
      UpdateLeanBudgetGuardrailsSchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied budgetId must belong to this tenant.
    const budget = await database.leanBudget.findFirst({
      where: { id: budgetId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!budget) {
      throw new Error("Orçamento inválido.");
    }

    const updated = await database.leanBudget.update({
      where: { id: budgetId },
      data: {
        capexPct,
        opexPct,
        spendLimitUsd: spendLimitUsd ?? null,
        approvalThresholdUsd: approvalThresholdUsd ?? null,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "lean_budget",
      entityId: updated.id,
      diff: { capexPct, opexPct, spendLimitUsd, approvalThresholdUsd },
    });
    revalidateTag(`budgets:${ctx.tenantId}`, "max");
    return { id: updated.id };
  });
}
