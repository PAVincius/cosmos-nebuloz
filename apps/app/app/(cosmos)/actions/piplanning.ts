"use server";

// piplanning.ts — getActivePiPlanning(): active PI's objectives, ROAM risks,
// and latest confidence-vote average, all tenant-scoped.

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type PiPlanningView = {
  piPlanName: string;
  objectives: {
    id: string;
    title: string;
    businessValue: number;
    status: string;
    isStretch: boolean;
  }[];
  risks: { id: string; title: string; roamStatus: string }[];
  confidenceAvg: number | null;
};

export async function getActivePiPlanning(): Promise<
  Result<PiPlanningView | null>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const plan = await database.pIPlan.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ["PLANNING", "COMMITTED", "EXECUTING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        piObjectives: {
          select: {
            id: true,
            title: true,
            businessValue: true,
            status: true,
            isStretch: true,
          },
        },
        risks: { select: { id: true, title: true, roamStatus: true } },
      },
    });
    if (!plan) {
      return null;
    }

    const tally = await database.confidenceVoteTally.findFirst({
      where: { tenantId: ctx.tenantId, piPlanId: plan.id },
      orderBy: { createdAt: "desc" },
      select: { aggregateScore: true },
    });

    return {
      piPlanName: plan.name,
      objectives: plan.piObjectives,
      risks: plan.risks,
      confidenceAvg: tally?.aggregateScore ?? null,
    };
  });
}
