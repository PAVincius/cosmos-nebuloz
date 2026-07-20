"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

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

export { listSolutionTrains };
