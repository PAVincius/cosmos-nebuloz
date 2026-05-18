"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type RoamStatus = "resolved" | "owned" | "accepted" | "mitigated";

export async function updateRiskStatus(riskId: string, status: string) {
  const ctx = await requireTenantSession(await headers());

  const risk = await database.risk.findFirst({
    where: { id: riskId, tenantId: ctx.tenantId },
    include: { piPlan: { include: { art: true } } },
  });
  if (!risk) throw new Error("Risco não encontrado.");

  const updated = await database.risk.update({
    where: { id: riskId },
    data: { status },
  });

  revalidatePath(`/arts/${risk.piPlan?.art.id}/pi-planning`);
  return updated;
}

export async function createRisk(data: {
  piPlanId: string;
  title: string;
  description?: string;
  impact: string;
  probability: string;
  category?: string;
  status?: string;
}) {
  const ctx = await requireTenantSession(await headers());

  const piPlan = await database.pIPlan.findFirst({
    where: { id: data.piPlanId, tenantId: ctx.tenantId },
    include: { art: true },
  });
  if (!piPlan) throw new Error("PI Plan não encontrado.");

  const risk = await database.risk.create({
    data: {
      tenantId: ctx.tenantId,
      piPlanId: data.piPlanId,
      title: data.title,
      description: data.description,
      impact: data.impact,
      probability: data.probability,
      category: data.category,
      status: data.status ?? "owned",
    },
  });

  revalidatePath(`/arts/${piPlan.art.id}/pi-planning`);
  return risk;
}
