"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { logAudit } from "../audit/index";
import { CreatePIPlanSchema } from "../schemas";
import type {
  CreatePIPlanDetailsInput,
  PIObjectiveInput,
  PIRiskInput,
} from "./schema";

export type { PIObjectiveInput, PIRiskInput, CreatePIPlanDetailsInput };

// ─── Legacy simple create (kept for compat) ───────────────────────────────────

export async function createPIPlan(input: {
  artId: string;
  name: string;
  startDate?: string;
  endDate?: string;
}) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  const validated = CreatePIPlanSchema.parse(input);

  const art = await database.aRT.findFirst({
    where: { id: validated.artId, tenantId: ctx.tenantId },
  });
  if (!art) {
    throw new Error("ART not found or access denied");
  }

  const plan = await database.pIPlan.create({
    data: {
      tenantId: ctx.tenantId,
      artId: validated.artId,
      name: validated.name,
      startDate: validated.startDate,
      endDate: validated.endDate,
    },
  });

  revalidatePath(`/arts/${validated.artId}`);
  return plan;
}

// ─── Full wizard create ────────────────────────────────────────────────────────

export async function createPIPlanWithDetails(raw: CreatePIPlanDetailsInput) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  const validated = CreatePIPlanSchema.parse(raw);

  const art = await database.aRT.findFirst({
    where: { id: validated.artId, tenantId: ctx.tenantId },
  });
  if (!art) {
    throw new Error("ART not found or access denied");
  }

  const plan = await database.$transaction(async (tx) => {
    const pi = await tx.pIPlan.create({
      data: {
        tenantId: ctx.tenantId,
        artId: validated.artId,
        name: validated.name,
        startDate: validated.startDate,
        endDate: validated.endDate,
      },
    });

    if (raw.featureIds.length > 0) {
      await tx.feature.updateMany({
        where: { id: { in: raw.featureIds }, tenantId: ctx.tenantId },
        data: { piPlanId: pi.id },
      });
    }

    if (raw.objectives.length > 0) {
      await tx.pIObjective.createMany({
        data: raw.objectives.map((o) => ({
          tenantId: ctx.tenantId,
          piPlanId: pi.id,
          teamId: o.teamId,
          title: o.title,
          description: o.description,
          businessValue: o.businessValue,
          isStretch: o.isStretch,
          status: "NOT_STARTED",
        })),
      });
    }

    if (raw.risks.length > 0) {
      await tx.risk.createMany({
        data: raw.risks.map((r) => ({
          tenantId: ctx.tenantId,
          piPlanId: pi.id,
          title: r.title,
          description: r.description,
          status: r.status,
          category: r.category,
          impact: r.impact,
          probability: r.probability,
        })),
      });
    }

    return pi;
  });

  revalidatePath(`/arts/${raw.artId}`);
  revalidatePath("/risks");
  return plan;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPIPlanById(piId: string) {
  const ctx = await requireTenantSession(await headers());

  return database.pIPlan.findFirst({
    where: { id: piId, tenantId: ctx.tenantId },
    include: {
      art: true,
      piSessions: {
        include: { confidenceSessions: { orderBy: { roundNumber: "asc" } } },
      },
    },
  });
}

export async function getBacklogFeatures() {
  const ctx = await requireTenantSession(await headers());
  return database.feature.findMany({
    where: { tenantId: ctx.tenantId, piPlanId: null },
    include: { epic: { select: { id: true, title: true } } },
    orderBy: { wsjfScore: "desc" },
  });
}

export async function getTeamsForART(artId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.team.findMany({
    where: { artId, tenantId: ctx.tenantId },
    orderBy: { name: "asc" },
  });
}

export async function getPIPlanWithDetails(artId: string) {
  const ctx = await requireTenantSession(await headers());

  const latestPlan = await database.pIPlan.findFirst({
    where: { artId, tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      artId: true,
      art: { select: { id: true, name: true, cadence: true } },
      piSessions: {
        select: {
          id: true,
          type: true,
          confidenceSessions: {
            orderBy: { roundNumber: "asc" },
            select: {
              id: true,
              roundNumber: true,
              xStateStatus: true,
              votes: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!latestPlan) {
    return null;
  }

  const [objectives, risks, features, teams] = await Promise.all([
    database.pIObjective.findMany({
      where: { piPlanId: latestPlan.id, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    database.risk.findMany({
      where: { piPlanId: latestPlan.id, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    database.feature.findMany({
      where: { piPlanId: latestPlan.id, tenantId: ctx.tenantId },
      include: { epic: { select: { id: true, title: true } } },
      orderBy: { wsjfScore: "desc" },
    }),
    database.team.findMany({
      where: { artId, tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, velocity: true },
    }),
  ]);

  return { ...latestPlan, objectives, risks, features, teams };
}

export type PIPlanDetails = NonNullable<
  Awaited<ReturnType<typeof getPIPlanWithDetails>>
>;

export async function getPIPlanFullDetails(piPlanId: string) {
  const ctx = await requireTenantSession(await headers());

  const piPlan = await database.pIPlan.findFirst({
    where: { id: piPlanId, tenantId: ctx.tenantId },
    include: { art: true },
  });
  if (!piPlan) {
    return null;
  }

  const [objectives, risks, features, teams] = await Promise.all([
    database.pIObjective.findMany({
      where: { piPlanId, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    database.risk.findMany({
      where: { piPlanId, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    database.feature.findMany({
      where: { piPlanId, tenantId: ctx.tenantId },
      include: { epic: { select: { id: true, title: true } } },
      orderBy: { wsjfScore: "desc" },
    }),
    database.team.findMany({
      where: { artId: piPlan.artId, tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, velocity: true },
    }),
  ]);

  return { ...piPlan, objectives, risks, features, teams };
}

export type PIPlanFullDetails = NonNullable<
  Awaited<ReturnType<typeof getPIPlanFullDetails>>
>;

export async function updatePIObjective(
  id: string,
  data: {
    title?: string;
    description?: string;
    isStretch?: boolean;
    status?: string;
    businessValue?: number;
  }
) {
  const ctx = await requireTenantSession(await headers());

  const objective = await database.pIObjective.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { piPlan: { include: { art: true } } },
  });
  if (!objective) {
    throw new Error("Objetivo não encontrado.");
  }

  const updated = await database.pIObjective.update({
    where: { id },
    data,
  });

  void logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "updated",
    entityType: "PIObjective",
    entityId: id,
    diff: data as Record<string, string>,
  });

  revalidatePath(`/arts/${objective.piPlan.art.id}/pi-planning`);
  return updated;
}

export async function createPIObjective(data: {
  piPlanId: string;
  teamId?: string;
  title: string;
  description?: string;
  isStretch?: boolean;
  businessValue?: number;
}) {
  const ctx = await requireTenantSession(await headers());

  const piPlan = await database.pIPlan.findFirst({
    where: { id: data.piPlanId, tenantId: ctx.tenantId },
    include: { art: true },
  });
  if (!piPlan) {
    throw new Error("PI Plan não encontrado.");
  }

  const objective = await database.pIObjective.create({
    data: {
      tenantId: ctx.tenantId,
      piPlanId: data.piPlanId,
      teamId: data.teamId,
      title: data.title,
      description: data.description,
      isStretch: data.isStretch ?? false,
      businessValue: data.businessValue ?? 0,
      status: "NOT_STARTED",
    },
  });

  void logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "created",
    entityType: "PIObjective",
    entityId: objective.id,
    diff: { piPlanId: data.piPlanId, title: data.title },
  });

  revalidatePath(`/arts/${piPlan.art.id}/pi-planning`);
  return objective;
}
