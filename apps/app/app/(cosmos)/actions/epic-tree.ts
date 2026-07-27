"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import {
  parseTaskBlocks,
  type StoryNode,
  type StoryTasks,
  type TaskNode,
} from "./epic-tree.constants";

// Nível 3 da árvore. Carregado sob demanda quando o usuário expande uma
// feature — a página do épico nunca traz a árvore inteira no payload inicial.
export async function listFeatureStories(
  featureId: string
): Promise<Result<StoryNode[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const stories = await database.story.findMany({
      where: { tenantId: ctx.tenantId, featureId },
      select: {
        id: true,
        title: true,
        acceptanceCriteria: true,
        status: true,
        storyPoints: true,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return stories;
  });
}

// Nível 4 da árvore. Retorna também quais sources de integração estão ATIVAS
// neste tenant: a UI usa isso para decidir entre "abrir no provider" e o CTA
// âmbar "não conectado · Conectar". Nunca mostrar dado externo sem oferecer o
// caminho de conexão.
export async function listStoryTasks(
  storyId: string
): Promise<Result<StoryTasks>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const tasks = await database.task.findMany({
      where: { tenantId: ctx.tenantId, storyId },
      select: {
        id: true,
        title: true,
        status: true,
        estimateHours: true,
        assigneeUserId: true,
        externalSource: true,
        externalId: true,
        externalUrl: true,
        noteBlocks: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const integrations = await database.integration.findMany({
      where: { tenantId: ctx.tenantId, status: "ACTIVE" },
      select: { source: true },
    });

    const assigneeIds = [
      ...new Set(
        tasks
          .map((t) => t.assigneeUserId)
          .filter((id): id is string => id !== null)
      ),
    ];
    const users = assigneeIds.length
      ? await database.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const mapped: TaskNode[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      estimateHours: t.estimateHours,
      assigneeName: t.assigneeUserId
        ? (nameById.get(t.assigneeUserId) ?? null)
        : null,
      externalSource: t.externalSource,
      externalId: t.externalId,
      externalUrl: t.externalUrl,
      blocks: parseTaskBlocks(t.noteBlocks),
    }));

    return {
      tasks: mapped,
      connectedSources: [...new Set(integrations.map((i) => i.source))],
    };
  });
}
