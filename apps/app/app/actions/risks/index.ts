"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { logAudit } from "../audit/index";
import { dispatchEvent } from "../events";
import { enforce } from "../permissions";
import type { RiskWithPI } from "./schema";

const CreateRiskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z
    .enum(["IDENTIFIED", "RESOLVED", "OWNED", "ACCEPTED", "MITIGATED"])
    .default("IDENTIFIED"),
  category: z
    .enum(["technical", "business", "organizational", "external"])
    .optional(),
  impact: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  probability: z.enum(["low", "medium", "high"]).default("medium"),
  piPlanId: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export async function getRisks(piPlanId?: string): Promise<RiskWithPI[]> {
  const ctx = await requireTenantSession(await headers());
  return database.risk.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(piPlanId ? { piPlanId } : {}),
    },
    include: {
      piPlan: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { impact: "asc" }, { createdAt: "desc" }],
  }) as Promise<RiskWithPI[]>;
}

export async function createRisk(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Risk", "create");
  const data = CreateRiskSchema.parse(raw);

  if (data.piPlanId) {
    const pi = await database.pIPlan.findFirst({
      where: { id: data.piPlanId, tenantId: ctx.tenantId },
    });
    if (!pi) {
      throw new Error("PI Plan não encontrado.");
    }
  }

  const created = await database.risk.create({
    data: {
      tenantId: ctx.tenantId,
      title: data.title,
      description: data.description,
      status: data.status,
      category: data.category,
      impact: data.impact,
      probability: data.probability,
      piPlanId: data.piPlanId,
      ownerUserId: data.ownerUserId,
    },
  });

  void dispatchEvent({
    type: "risk.created",
    riskId: created.id,
    riskTitle: created.title,
    impact: created.impact,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });
  logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "created",
    entityType: "Risk",
    entityId: created.id,
  });

  revalidatePath("/risks");
}

export async function updateRiskStatus(id: string, status: string) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Risk", "update");
  const existing = await database.risk.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { title: true, ownerUserId: true, status: true },
  });
  await database.risk.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { status },
  });
  void dispatchEvent({
    type: "risk.status_changed",
    riskId: id,
    riskTitle: existing?.title ?? "",
    from: existing?.status ?? "",
    to: status,
    ownerUserId: existing?.ownerUserId ?? undefined,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });
  logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "updated",
    entityType: "Risk",
    entityId: id,
    diff: { status },
  });
  revalidatePath("/risks");
}

export async function updateRisk(id: string, raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Risk", "update");
  const data = CreateRiskSchema.partial().parse(raw);
  await database.risk.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data,
  });
  logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "updated",
    entityType: "Risk",
    entityId: id,
    diff: data as Record<string, string>,
  });
  revalidatePath("/risks");
}

export async function deleteRisk(id: string) {
  const ctx = await requireTenantSession(await headers());
  enforce(ctx.role, "Risk", "delete");
  await database.risk.deleteMany({ where: { id, tenantId: ctx.tenantId } });
  logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "deleted",
    entityType: "Risk",
    entityId: id,
  });
  revalidatePath("/risks");
}

export async function getPIPlans() {
  const ctx = await requireTenantSession(await headers());
  return database.pIPlan.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true, artId: true },
    orderBy: { createdAt: "desc" },
  });
}
