"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type LeanBudgetView = {
  id: string;
  name: string;
  themeName: string | null;
  artId: string | null;
  artName: string | null;
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
        artId: true,
        strategicTheme: { select: { title: true } },
      },
    });

    // LeanBudget.artId has no Prisma relation to ART (plain app-layer
    // reference) — resolve names with a separate tenant-scoped lookup.
    const artIds = [
      ...new Set(rows.map((b) => b.artId).filter(Boolean)),
    ] as string[];
    const arts = artIds.length
      ? await database.aRT.findMany({
          where: { id: { in: artIds }, tenantId: ctx.tenantId },
          select: { id: true, name: true },
        })
      : [];
    const artNameById = new Map(arts.map((a) => [a.id, a.name]));

    return rows.map((b) => {
      const spent = Number(b.spent ?? 0);
      return {
        id: b.id,
        name: b.name,
        themeName: b.strategicTheme?.title ?? null,
        artId: b.artId,
        artName: b.artId ? (artNameById.get(b.artId) ?? null) : null,
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

export type ValueStreamDetailView = {
  id: string; // ART id — "value stream" has no dedicated model (see
  // governance.prisma GovernedEpic.valueStreamId comment); it IS the ART.
  name: string;
  budgetCount: number;
  budgetAllocated: number;
  spent: number;
  spendLimitUsd: number | null;
  utilizationPct: number;
  // % of the hard spend limit (LeanBudget.spendLimitUsd — the schema's own
  // "guardrail" field) consumed so far. Distinct from utilizationPct (spend
  // vs. total allocated budget, already surfaced on the Lean Budgets list):
  // this is "how close to breaching the guardrail," matching the design's
  // "guardrail rompido" badge. null (never 0) when no budget for this ART
  // has a spend limit set — there is no guardrail to measure against yet.
  guardrailPct: number | null;
  // The investment horizon this value stream's budgets are classified into
  // (LeanBudget.horizonId) — null when none of its budgets have been
  // classified, or when they disagree (no single horizon to show).
  horizon: { id: string; name: string; label: string } | null;
  epics: {
    id: string;
    title: string;
    wsjf: number | null;
    progressPct: number;
  }[];
  epicCount: number;
};

export async function getValueStreamDetail(
  artId: string
): Promise<Result<ValueStreamDetailView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    // IDOR guard — client-supplied artId must belong to this tenant.
    const art = await database.aRT.findFirst({
      where: { id: artId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    if (!art) {
      throw new Error("Value stream não encontrado.");
    }

    const [budgets, governedEpics] = await Promise.all([
      database.leanBudget.findMany({
        where: { tenantId: ctx.tenantId, artId },
        select: {
          amount: true,
          spent: true,
          spendLimitUsd: true,
          horizonId: true,
        },
      }),
      database.governedEpic.findMany({
        where: { tenantId: ctx.tenantId, valueStreamId: artId },
        select: {
          epic: {
            select: {
              id: true,
              title: true,
              wsjf: true,
              featureCount: true,
              doneFeatureCount: true,
            },
          },
        },
      }),
    ]);

    const budgetAllocated = budgets.reduce((s, b) => s + b.amount, 0);
    const spent = budgets.reduce((s, b) => s + Number(b.spent ?? 0), 0);
    const budgetsWithLimit = budgets.filter(
      (b): b is typeof b & { spendLimitUsd: number } => b.spendLimitUsd !== null
    );
    const spendLimitUsd = budgetsWithLimit.length
      ? budgetsWithLimit.reduce((s, b) => s + b.spendLimitUsd, 0)
      : null;
    const guardrailPct =
      spendLimitUsd !== null && spendLimitUsd > 0
        ? Math.round((spent / spendLimitUsd) * 100)
        : null;

    const epics = governedEpics.map(({ epic: e }) => ({
      id: e.id,
      title: e.title,
      wsjf: e.wsjf,
      progressPct:
        e.featureCount > 0
          ? Math.round((e.doneFeatureCount / e.featureCount) * 100)
          : 0,
    }));

    // Only show a horizon when every budget for this ART agrees on one —
    // a mixed classification has no single honest answer to display.
    const horizonIds = new Set(
      budgets.map((b) => b.horizonId).filter((v): v is string => v !== null)
    );
    const singleHorizonId = horizonIds.size === 1 ? [...horizonIds][0] : null;
    const horizon = singleHorizonId
      ? await database.investmentHorizon.findFirst({
          where: { id: singleHorizonId, tenantId: ctx.tenantId },
          select: { id: true, name: true, label: true },
        })
      : null;

    return {
      id: art.id,
      name: art.name,
      budgetCount: budgets.length,
      budgetAllocated,
      spent,
      spendLimitUsd,
      utilizationPct:
        budgetAllocated > 0 ? Math.round((spent / budgetAllocated) * 100) : 0,
      guardrailPct,
      horizon,
      epics,
      epicCount: epics.length,
    };
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
