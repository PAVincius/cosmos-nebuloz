"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const ALLOWED_ROLES = new Set(["ADMIN", "RTE"]);

const OverrideSchema = z.object({
  epicId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  justification: z.string().min(10).max(1000),
});

export async function overrideInvestScore(
  raw: unknown
): Promise<Result<{ investScore: number }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    if (!ALLOWED_ROLES.has(ctx.role)) {
      throw new Error("FORBIDDEN");
    }

    const { epicId, score, justification } = OverrideSchema.parse(raw);

    const epic = await database.epic.findFirstOrThrow({
      where: { id: epicId, tenantId: ctx.tenantId },
      select: { investScore: true, lifecycleStatus: true },
    });

    await database.epic.update({
      where: { id: epicId },
      data: {
        investScore: score,
        investScoreOverridden: true,
        investScoreOutdated: false,
      },
    });

    await database.decisionLogEntry.create({
      data: {
        tenantId: ctx.tenantId,
        tipo: "INVEST_OVERRIDE",
        targetType: "epic",
        targetId: epicId,
        decisao: "override",
        justificativa: justification,
        decisorId: ctx.userId,
        dadosSuporte: {
          prevScore: epic.investScore,
          newScore: score,
          lifecycleStatus: epic.lifecycleStatus,
        },
      },
    });

    return { investScore: score };
  });
}
