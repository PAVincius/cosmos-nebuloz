"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export async function getEpicDetailFull(epicId: string): Promise<Result<any>> {
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
        descriptionVersions: true,
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
        },
      },
    });

    if (!epic) {
      return null;
    }

    const piPlanIds = [
      ...new Set(
        epic.features.map((f) => f.piPlanId).filter((id) => id !== null)
      ),
    ] as string[];

    const piObjectives = await database.pIObjective.findMany({
      where: {
        tenantId: ctx.tenantId,
        piPlanId: { in: piPlanIds },
      },
      select: {
        id: true,
        title: true,
        status: true,
        businessValue: true,
        achievedValue: true,
      },
    });

    const governance = await database.governedEpic.findFirst({
      where: { epicId: epic.id, tenantId: ctx.tenantId },
      select: {
        id: true,
        governanceStatus: true,
        currentApprovalRequestId: true,
      },
    });

    const featuresWithoutPiPlanId = epic.features.map(
      ({ piPlanId, ...rest }) => rest
    );

    return {
      ...epic,
      features: featuresWithoutPiPlanId,
      piObjectives,
      governance: governance || {
        governanceStatus: "none",
        id: null,
        currentApprovalRequestId: null,
      },
    };
  });
}
