"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type LbcItem = { id: string; text: string };

export type EpicDetailFull = {
  id: string;
  title: string;
  lifecycleStatus: string;
  wsjf: number | null;
  sizePoints: number | null;
  investScore: number | null;
  hypothesis: string | null;
  hypothesisResolution: string | null;
  businessOutcomes: LbcItem[];
  leadingIndicators: LbcItem[];
  nfrs: string | null;
  mvp: string | null;
  sizeEstimate: string | null;
  leanBudgetAllocation: number | null;
  features: {
    id: string;
    title: string;
    statusId: string;
    wsjfScore: number;
    progressPct: number;
    storyPoints: number;
  }[];
  piObjectives: {
    id: string;
    title: string;
    status: string;
    businessValue: number;
    achievedValue: number;
  }[];
  governance: {
    governedEpicId: string | null;
    governanceStatus: string | null;
    currentApprovalRequestId: string | null;
  };
};

export async function getEpicDetailFull(
  epicId: string
): Promise<Result<EpicDetailFull | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: epicId, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        lifecycleStatus: true,
        wsjf: true,
        sizePoints: true,
        investScore: true,
        hypothesis: true,
        hypothesisResolution: true,
        businessOutcomes: true,
        leadingIndicators: true,
        nfrs: true,
        mvp: true,
        sizeEstimate: true,
        // Scope cut (explicit, not a placeholder): the PRD's FinOps "cost
        // burn widget" (actual spend vs. leanBudgetAllocation) is out of
        // scope — no actualSpend/spentAmount field exists anywhere in the
        // schema. Only the allocation itself is returned below, no burn
        // calculation.
        leanBudgetAllocation: true,
        features: {
          select: {
            id: true,
            title: true,
            statusId: true,
            wsjfScore: true,
            progressPct: true,
            storyPoints: true,
            piPlanId: true,
          },
          orderBy: { wsjfScore: "desc" },
        },
      },
    });
    if (!epic) {
      return null;
    }

    // Schema has no direct Epic↔PIObjective relation: PIObjective links to
    // piPlanId+teamId only. We treat "PI Objectives linked to this epic" as
    // objectives sharing a piPlanId with one of the epic's own features —
    // the piPlanId values are already tenant-scoped via the epic query above.
    const piPlanIds = [
      ...new Set(
        epic.features.map((f) => f.piPlanId).filter((id): id is string => !!id)
      ),
    ];
    const piObjectives = piPlanIds.length
      ? await database.pIObjective.findMany({
          where: { tenantId: ctx.tenantId, piPlanId: { in: piPlanIds } },
          select: {
            id: true,
            title: true,
            status: true,
            businessValue: true,
            achievedValue: true,
          },
        })
      : [];

    const governedEpic = await database.governedEpic.findFirst({
      where: { epicId: epic.id, tenantId: ctx.tenantId },
      select: {
        id: true,
        governanceStatus: true,
        currentApprovalRequestId: true,
      },
    });

    return {
      id: epic.id,
      title: epic.title,
      lifecycleStatus: epic.lifecycleStatus,
      wsjf: epic.wsjf,
      sizePoints: epic.sizePoints,
      investScore: epic.investScore,
      hypothesis: epic.hypothesis,
      hypothesisResolution: epic.hypothesisResolution,
      businessOutcomes: Array.isArray(epic.businessOutcomes)
        ? (epic.businessOutcomes as LbcItem[])
        : [],
      leadingIndicators: Array.isArray(epic.leadingIndicators)
        ? (epic.leadingIndicators as LbcItem[])
        : [],
      nfrs: epic.nfrs,
      mvp: epic.mvp,
      sizeEstimate: epic.sizeEstimate,
      leanBudgetAllocation: epic.leanBudgetAllocation,
      features: epic.features.map(({ piPlanId, ...f }) => f),
      piObjectives,
      governance: {
        governedEpicId: governedEpic?.id ?? null,
        governanceStatus: governedEpic?.governanceStatus ?? null,
        currentApprovalRequestId:
          governedEpic?.currentApprovalRequestId ?? null,
      },
    };
  });
}
