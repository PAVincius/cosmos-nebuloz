"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type ProgramBoardView = {
  piPlanName: string;
  teams: {
    id: string;
    name: string;
    features: {
      id: string;
      title: string;
      storyPoints: number;
      statusId: string;
    }[];
  }[];
};

export async function getActiveProgramBoard(): Promise<
  Result<ProgramBoardView | null>
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
        features: {
          select: {
            id: true,
            title: true,
            storyPoints: true,
            statusId: true,
            assignedTeamId: true,
          },
        },
      },
    });
    if (!plan) {
      return null;
    }

    const teamIds = [
      ...new Set(
        plan.features
          .map((f) => f.assignedTeamId)
          .filter((id): id is string => !!id)
      ),
    ];
    const teams = teamIds.length
      ? await database.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : [];

    return {
      piPlanName: plan.name,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        features: plan.features
          .filter((f) => f.assignedTeamId === t.id)
          .map((f) => ({
            id: f.id,
            title: f.title,
            storyPoints: f.storyPoints,
            statusId: f.statusId,
          })),
      })),
    };
  });
}
