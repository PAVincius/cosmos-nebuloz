"use server";

// horizons.ts — InvestmentHorizon (Emerging/Growth/Core) actions. An
// investment horizon groups value streams (ARTs, via LeanBudget.horizonId)
// by maturity/risk bet, with a target % of portfolio investment compared
// against the real actual % — always derived from live LeanBudget rows,
// never stored (see the InvestmentHorizon model comment in portfolio.prisma).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type InvestmentHorizonView = {
  id: string;
  name: string;
  label: string;
  targetPct: number;
  order: number;
};

export async function listInvestmentHorizons(): Promise<
  Result<InvestmentHorizonView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.investmentHorizon.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        label: true,
        targetPct: true,
        order: true,
      },
    });
    return rows;
  });
}

export type InvestmentHorizonDetailView = {
  id: string;
  name: string;
  label: string;
  targetPct: number;
  // % of the tenant's total LeanBudget amount that is classified into this
  // horizon. null only when the tenant has no LeanBudget rows at all yet
  // (no denominator to compute a share of) — never fabricated, never 0
  // when the real answer is "no data".
  actualPct: number | null;
  valueStreams: {
    artId: string;
    artName: string;
    budgetAllocated: number;
  }[];
};

export async function getInvestmentHorizon(
  id: string
): Promise<Result<InvestmentHorizonDetailView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const horizon = await database.investmentHorizon.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, name: true, label: true, targetPct: true },
    });
    if (!horizon) {
      throw new Error("Horizonte de investimento não encontrado.");
    }

    const [horizonBudgets, allBudgets] = await Promise.all([
      database.leanBudget.findMany({
        where: { tenantId: ctx.tenantId, horizonId: id },
        select: { amount: true, artId: true },
      }),
      database.leanBudget.findMany({
        where: { tenantId: ctx.tenantId },
        select: { amount: true },
      }),
    ]);

    const horizonTotal = horizonBudgets.reduce((s, b) => s + b.amount, 0);
    const portfolioTotal = allBudgets.reduce((s, b) => s + b.amount, 0);
    const actualPct =
      portfolioTotal > 0
        ? Math.round((horizonTotal / portfolioTotal) * 1000) / 10
        : null;

    // LeanBudget.artId has no Prisma relation to ART — resolve names
    // tenant-scoped, same as getValueStreamDetail/listLeanBudgets.
    const artIds = [
      ...new Set(horizonBudgets.map((b) => b.artId).filter(Boolean)),
    ] as string[];
    const arts = artIds.length
      ? await database.aRT.findMany({
          where: { id: { in: artIds }, tenantId: ctx.tenantId },
          select: { id: true, name: true },
        })
      : [];
    const artNameById = new Map(arts.map((a) => [a.id, a.name]));

    const allocatedByArt = new Map<string, number>();
    for (const b of horizonBudgets) {
      if (!b.artId) {
        continue;
      }
      allocatedByArt.set(
        b.artId,
        (allocatedByArt.get(b.artId) ?? 0) + b.amount
      );
    }

    const valueStreams = artIds.map((artId) => ({
      artId,
      artName: artNameById.get(artId) ?? artId,
      budgetAllocated: allocatedByArt.get(artId) ?? 0,
    }));

    return {
      id: horizon.id,
      name: horizon.name,
      label: horizon.label,
      targetPct: horizon.targetPct,
      actualPct,
      valueStreams,
    };
  });
}

const CreateInvestmentHorizonSchema = z.object({
  name: z.string().min(1).max(200),
  label: z.string().min(1).max(80),
  targetPct: z.number().min(0).max(100),
  order: z.number().int().min(0).optional(),
});

export async function createInvestmentHorizon(
  input: z.input<typeof CreateInvestmentHorizonSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { name, label, targetPct, order } =
      CreateInvestmentHorizonSchema.parse(input);

    const created = await database.investmentHorizon.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        label,
        targetPct,
        order: order ?? 0,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "investment_horizon",
      entityId: created.id,
      diff: { name, label, targetPct },
    });
    revalidateTag(`horizons:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}
