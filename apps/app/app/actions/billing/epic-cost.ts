"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type EpicCostResult = {
  epicId: string;
  themeId: string | null;
  totalCost: number;
  currency: string;
  hasMapping: boolean;
};

export async function getEpicCost(epicId: string): Promise<EpicCostResult> {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId },
    select: { id: true, themeId: true },
  });

  if (!epic) {
    throw new Error("Epic não encontrada.");
  }

  if (!epic.themeId) {
    return { epicId, themeId: null, totalCost: 0, currency: "USD", hasMapping: false };
  }

  const agg = await database.billingEntry.aggregate({
    where: { tenantId, themeId: epic.themeId },
    _sum: { effectiveCost: true },
  });

  return {
    epicId,
    themeId: epic.themeId,
    totalCost: agg._sum.effectiveCost ? Number(agg._sum.effectiveCost) : 0,
    currency: "USD",
    hasMapping: true,
  };
}
