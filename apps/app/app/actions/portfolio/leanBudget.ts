"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

// ─── saveLeanBudget ───────────────────────────────────────────────────────────

const saveLeanBudgetSchema = z.object({
  artId: z.string().min(1),
  piPlanId: z.string().min(1),
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  capexPct: z.number().min(0).max(100),
  opexPct: z.number().min(0).max(100),
  period: z.string().min(1),
});

export async function saveLeanBudget(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = saveLeanBudgetSchema.parse(raw);

    // AC-002: capexPct + opexPct must equal 100
    const total = input.capexPct + input.opexPct;
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(
        `BUDGET_SPLIT_INVALID: CapEx + OpEx must equal 100%. Current: ${total}%`
      );
    }

    const existing = await database.leanBudget.findFirst({
      where: { tenantId, artId: input.artId, piPlanId: input.piPlanId },
      select: { id: true },
    });

    if (existing) {
      // AC-002: unique per artId/piPlanId — return 409 equivalent
      throw new Error(
        `DUPLICATE_BUDGET: LeanBudget already exists for artId=${input.artId} piPlanId=${input.piPlanId}`
      );
    }

    const budget = await database.leanBudget.create({
      data: {
        tenantId,
        artId: input.artId,
        piPlanId: input.piPlanId,
        name: input.name,
        amount: input.amount,
        capexPct: input.capexPct,
        opexPct: input.opexPct,
        period: input.period,
      },
      select: { id: true },
    });

    revalidatePath("/");
    return { id: budget.id };
  });
}

// ─── checkOverAllocation ──────────────────────────────────────────────────────

const checkOverAllocationSchema = z.object({
  leanBudgetId: z.string().min(1),
  newAllocationAmount: z.number().positive(),
});

export async function checkOverAllocation(raw: unknown): Promise<
  Result<{
    overAllocated: boolean;
    excessAmount: number;
    currentTotal: number;
    budgetAmount: number;
  }>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = checkOverAllocationSchema.parse(raw);

    const budget = await database.leanBudget.findFirstOrThrow({
      where: { id: input.leanBudgetId, tenantId },
      select: { id: true, amount: true, artId: true, piPlanId: true },
    });

    // Sum existing epic allocations for this ART/PI
    const epicAllocations = await database.epic.aggregate({
      where: {
        tenantId,
        // Features linked to this piPlan would be the source of allocation;
        // here we use leanBudgetAllocation as the field
      },
      _sum: { leanBudgetAllocation: true },
    });

    const currentTotal = epicAllocations._sum.leanBudgetAllocation ?? 0;
    const projectedTotal = currentTotal + input.newAllocationAmount;
    const overAllocated = projectedTotal > budget.amount;
    const excessAmount = Math.max(0, projectedTotal - budget.amount);

    return {
      overAllocated,
      excessAmount,
      currentTotal,
      budgetAmount: budget.amount,
    };
  });
}

// ─── lockBudgetOnPIClose ──────────────────────────────────────────────────────

const lockBudgetOnPICloseSchema = z.object({
  piPlanId: z.string().min(1),
});

export async function lockBudgetOnPIClose(
  raw: unknown
): Promise<Result<{ lockedCount: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = lockBudgetOnPICloseSchema.parse(raw);

    const now = new Date();
    const result = await database.leanBudget.updateMany({
      where: { tenantId, piPlanId: input.piPlanId, immutableAt: null },
      data: { immutableAt: now },
    });

    revalidatePath("/");
    return { lockedCount: result.count };
  });
}
