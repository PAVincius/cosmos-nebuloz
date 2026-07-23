"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { calculateWSJF } from "@repo/safe-engine";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

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
          where: { id: { in: teamIds }, tenantId: ctx.tenantId },
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

const CreateFeatureSchema = z.object({
  title: z.string().min(1).max(200),
  epicId: z.string().optional(),
  assignedTeamId: z.string().optional(),
  bv: z.number().min(0).max(10).default(0),
  tc: z.number().min(0).max(10).default(0),
  rr: z.number().min(0).max(10).default(0),
  js: z.number().min(1).max(10).default(1),
});

export async function createFeature(
  input: z.input<typeof CreateFeatureSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { title, epicId, assignedTeamId, bv, tc, rr, js } =
      CreateFeatureSchema.parse(input);

    // Cross-tenant IDOR guards — client-supplied FKs must belong to this tenant.
    if (epicId) {
      const epic = await database.epic.findFirst({
        where: { id: epicId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!epic) {
        throw new Error("Épico inválido.");
      }
    }
    if (assignedTeamId) {
      const team = await database.team.findFirst({
        where: { id: assignedTeamId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!team) {
        throw new Error("Time inválido.");
      }
    }

    const wsjfScore = calculateWSJF({ bv, tc, rr, js });

    const created = await database.feature.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        epicId: epicId ?? null,
        assignedTeamId: assignedTeamId ?? null,
        bv,
        tc,
        rr,
        js,
        wsjfScore,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "feature",
      entityId: created.id,
      diff: { title },
    });
    revalidateTag(`program:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}
