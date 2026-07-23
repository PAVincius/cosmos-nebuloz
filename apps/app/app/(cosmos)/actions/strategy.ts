"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type PillarView = {
  id: string;
  name: string;
  tone: string;
  themes: {
    id: string;
    title: string;
    healthStatus: string;
    targetAllocationPct: number | null;
  }[];
};

export async function listStrategyPillars(): Promise<Result<PillarView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.strategyPillar.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        tone: true,
        themes: {
          select: {
            id: true,
            title: true,
            healthStatus: true,
            targetAllocationPct: true,
          },
        },
      },
    });
    return rows;
  });
}

const CreatePillarSchema = z.object({
  name: z.string().min(1).max(200),
  tone: z.string().min(1).max(40).optional(),
});

export async function createPillar(
  input: z.input<typeof CreatePillarSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { name, tone } = CreatePillarSchema.parse(input);

    const created = await database.strategyPillar.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        tone: tone ?? "accent",
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "pillar",
      entityId: created.id,
      diff: { name },
    });
    revalidateTag(`strategy:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}
