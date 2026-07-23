"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type SolutionTrainView = {
  id: string;
  name: string;
  description: string | null;
  artCount: number;
  epicCount: number;
  capabilityCount: number;
};

async function listSolutionTrains(): Promise<Result<SolutionTrainView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const trains = await database.solutionTrain.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        arts: { select: { id: true } },
        solutionEpics: { select: { id: true } },
        capabilities: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    });

    return trains.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      artCount: s.arts.length,
      epicCount: s.solutionEpics.length,
      capabilityCount: s.capabilities.length,
    }));
  });
}

const CAPABILITY_STATUSES = [
  "BACKLOG",
  "ANALYZING",
  "IMPLEMENTING",
  "DONE",
] as const;

const CreateCapabilitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(CAPABILITY_STATUSES).default("BACKLOG"),
  milestone: z.string().max(200).optional(),
  solutionTrainId: z.string().min(1).optional(),
});

async function createCapability(
  input: z.input<typeof CreateCapabilitySchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { title, description, status, milestone, solutionTrainId } =
      CreateCapabilitySchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied solutionTrainId must belong
    // to this tenant.
    if (solutionTrainId) {
      const train = await database.solutionTrain.findFirst({
        where: { id: solutionTrainId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!train) {
        throw new Error("Solution Train inválido.");
      }
    }

    const created = await database.capability.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        description: description ?? null,
        status,
        milestone: milestone ?? null,
        solutionTrainId: solutionTrainId ?? null,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "capability",
      entityId: created.id,
      diff: { title, status, solutionTrainId },
    });
    revalidateTag(`solution-train:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

export { createCapability, listSolutionTrains };
