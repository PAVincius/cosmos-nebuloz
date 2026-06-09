"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function getBpmnDefinition(teamId: string) {
  const ctx = await requireTenantSession(await headers());

  const definition = await database.bpmnDefinition.findFirst({
    where: { tenantId: ctx.tenantId, teamId },
    orderBy: { version: "desc" },
  });

  return definition?.xmlContent ?? null;
}

export async function saveBpmnDefinition(teamId: string, xmlContent: string) {
  const ctx = await requireTenantSession(await headers());

  if (!(xmlContent && xmlContent.includes("<bpmn:"))) {
    throw new Error("Conteúdo XML inválido para notação BPMN.");
  }

  const current = await database.bpmnDefinition.findFirst({
    where: { tenantId: ctx.tenantId, teamId },
    orderBy: { version: "desc" },
  });

  const nextVersion = current ? current.version + 1 : 1;

  await database.bpmnDefinition.create({
    data: { tenantId: ctx.tenantId, teamId, xmlContent, version: nextVersion },
  });

  revalidatePath(`/workflows/${teamId}/bpmn`);
}
