"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import {
  DEFAULT_NOTE_BLOCKS,
  parseTaskBlocks,
  type StoryNode,
  type StoryTasks,
  TASK_STATUS_IDS,
  type TaskBlock,
  TaskBlocksSchema,
  type TaskNode,
  WRITE_ROLES,
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

// Um único mapper para os dois writes — a UI substitui a linha inteira pelo
// TaskNode retornado, então create e update precisam devolver a mesma forma
// que listStoryTasks devolve.
function toTaskNode(row: {
  id: string;
  title: string;
  status: string;
  estimateHours: number | null;
  externalSource: string | null;
  externalId: string | null;
  externalUrl: string | null;
  noteBlocks: unknown;
}): TaskNode {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    estimateHours: row.estimateHours,
    assigneeName: null,
    externalSource: row.externalSource,
    externalId: row.externalId,
    externalUrl: row.externalUrl,
    blocks: parseTaskBlocks(row.noteBlocks),
  };
}

const TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  estimateHours: true,
  externalSource: true,
  externalId: true,
  externalUrl: true,
  noteBlocks: true,
} as const;

export async function createNativeTask(input: {
  storyId: string;
  title: string;
}): Promise<Result<TaskNode>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(WRITE_ROLES, ctx);

    const title = input.title.trim();
    if (!title) {
      throw new Error("Título da task é obrigatório.");
    }

    // storyId vem do cliente. Sem esta checagem, um caller do tenant B pode
    // criar uma task com tenantId B pendurada numa story do tenant A —
    // escrita cross-tenant. O tenantId da linha nova não protege o pai.
    const story = await database.story.findFirst({
      where: { id: input.storyId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!story) {
      throw new Error("Story não encontrada.");
    }

    const created = await database.task.create({
      data: {
        tenantId: ctx.tenantId,
        storyId: input.storyId,
        title,
        status: "TODO",
        // Explicitamente nativa: nenhuma ferramenta externa é dona deste item.
        externalSource: null,
        externalId: null,
        externalUrl: null,
        noteBlocks: DEFAULT_NOTE_BLOCKS,
      },
      select: TASK_SELECT,
    });

    return toTaskNode(created);
  });
}

export async function updateNativeTask(input: {
  taskId: string;
  title?: string;
  status?: string;
  blocks?: TaskBlock[];
}): Promise<Result<TaskNode>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(WRITE_ROLES, ctx);

    // A checagem de tenant e a de origem acontecem na mesma leitura: uma task
    // importada é read-only aqui — a edição pertence à ferramenta de origem.
    const existing = await database.task.findFirst({
      where: { id: input.taskId, tenantId: ctx.tenantId },
      select: { id: true, externalSource: true },
    });
    if (!existing) {
      throw new Error("Task não encontrada.");
    }
    if (existing.externalSource) {
      throw new Error(
        "Task importada de ferramenta externa não pode ser editada no Cosmos."
      );
    }

    const data: {
      title?: string;
      status?: string;
      noteBlocks?: TaskBlock[];
    } = {};

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) {
        throw new Error("Título da task é obrigatório.");
      }
      data.title = title;
    }
    if (input.status !== undefined) {
      if (!TASK_STATUS_IDS.includes(input.status)) {
        throw new Error(`Status inválido: ${input.status}`);
      }
      data.status = input.status;
    }
    if (input.blocks !== undefined) {
      const parsed = TaskBlocksSchema.safeParse(input.blocks);
      if (!parsed.success) {
        throw new Error("Conteúdo da nota inválido.");
      }
      data.noteBlocks = parsed.data;
    }

    const updated = await database.task.update({
      // Re-escopar por tenant aqui é redundante com o findFirst acima hoje,
      // mas não depende da ordem do código: se alguém inserir um await entre
      // as duas chamadas, esta linha continua protegendo a escrita.
      where: { id: input.taskId, tenantId: ctx.tenantId },
      data,
      select: TASK_SELECT,
    });

    return toTaskNode(updated);
  });
}
