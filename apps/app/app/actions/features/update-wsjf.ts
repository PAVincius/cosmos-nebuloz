"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { calculateWSJF } from "@repo/safe-engine";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { portfolioEpicsCacheTag } from "../epics/portfolio-cache";
import { dispatchEvent } from "../events";
import { enforce } from "../permissions";
import { UpdateWSJFSchema } from "../schemas";

type WSJFResult = { featureId: string; wsjfScore: number };

export const updateFeatureWSJF = async (raw: unknown): Promise<WSJFResult> => {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE", "PO"], ctx);
  enforce(ctx.role, "WSJF", "update");

  const { featureId, bv, tc, rr, js } = UpdateWSJFSchema.parse(raw);
  const newWSJF = calculateWSJF({ bv, tc, rr, js });

  const feature = await database.feature.findFirst({
    where: { id: featureId, tenantId: ctx.tenantId },
    select: { title: true, wsjfScore: true },
  });

  const result = await database.feature.updateMany({
    where: { id: featureId, tenantId: ctx.tenantId },
    data: { bv, tc, rr, js, wsjfScore: newWSJF },
  });

  if (result.count === 0) {
    throw new Error("Feature not found or access denied");
  }

  void dispatchEvent({
    type: "feature.wsjf_updated",
    featureId,
    featureTitle: feature?.title ?? "",
    oldScore: feature?.wsjfScore ?? 0,
    newScore: newWSJF,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });

  revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");

  return { featureId, wsjfScore: newWSJF };
};
