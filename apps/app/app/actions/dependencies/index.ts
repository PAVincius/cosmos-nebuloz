"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { DependencyWithFeatures } from "./schema";

const CreateDependencySchema = z.object({
  blockingFeatureId: z.string().min(1),
  blockedFeatureId: z.string().min(1),
  description: z.string().optional(),
  status: z
    .enum(["not-started", "on-track", "at-risk", "blocked", "completed"])
    .default("not-started"),
  type: z
    .enum(["technical", "business", "organizational", "external"])
    .default("technical"),
  severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  notes: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export async function getDependencies(): Promise<DependencyWithFeatures[]> {
  const ctx = await requireTenantSession(await headers());
  return database.dependencyLink.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      blockingFeature: {
        select: {
          id: true,
          title: true,
          statusId: true,
          epicId: true,
          epic: { select: { id: true, title: true } },
        },
      },
      blockedFeature: {
        select: {
          id: true,
          title: true,
          statusId: true,
          epicId: true,
          epic: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  }) as Promise<DependencyWithFeatures[]>;
}

export async function createDependency(raw: unknown) {
  const ctx = await requireTenantSession(await headers());
  const data = CreateDependencySchema.parse(raw);

  if (data.blockingFeatureId === data.blockedFeatureId) {
    throw new Error("Uma feature não pode depender de si mesma.");
  }

  // Verify features belong to tenant
  const [blocking, blocked] = await Promise.all([
    database.feature.findFirst({
      where: { id: data.blockingFeatureId, tenantId: ctx.tenantId },
    }),
    database.feature.findFirst({
      where: { id: data.blockedFeatureId, tenantId: ctx.tenantId },
    }),
  ]);
  if (!(blocking && blocked)) {
    throw new Error("Feature não encontrada.");
  }

  await database.dependencyLink.create({
    data: {
      tenantId: ctx.tenantId,
      blockingFeatureId: data.blockingFeatureId,
      blockedFeatureId: data.blockedFeatureId,
      description: data.description,
      status: data.status,
      type: data.type,
      severity: data.severity,
      notes: data.notes,
      dueDate: data.dueDate,
    },
  });

  revalidatePath("/dependencies");
}

export async function updateDependencyStatus(id: string, status: string) {
  const ctx = await requireTenantSession(await headers());

  await database.dependencyLink.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { status },
  });

  revalidatePath("/dependencies");
}

export async function deleteDependency(id: string) {
  const ctx = await requireTenantSession(await headers());
  await database.dependencyLink.deleteMany({
    where: { id, tenantId: ctx.tenantId },
  });
  revalidatePath("/dependencies");
}

export async function getEpicsWithFeatures() {
  const ctx = await requireTenantSession(await headers());
  return database.epic.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      features: { select: { id: true, title: true, statusId: true } },
    },
    orderBy: { order: "asc" },
  });
}
