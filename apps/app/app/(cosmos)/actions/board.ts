"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { COLUNAS } from "./board.constants";

// Leitura do board do time (/cosmos/board, story-060). As mutações não moram
// aqui: createStory/updateStoryStatus vivem em app/actions/stories e
// createTask/updateTaskStatus em app/actions/tasks — ambas com guard de tenant,
// enforce de papel e, agora, teste. A tela importa de lá.
//
// Por que um read próprio em vez de listStories(): listStories devolve Page<T>
// paginada e por filtro, então montar o board exigiria uma chamada por coluna e
// mais uma por story para as tasks. Aqui é uma ida ao banco para o quadro
// inteiro, já agrupado, com a contagem de task que o card precisa.

export type BoardStoryView = {
  id: string;
  title: string;
  storyPoints: number;
  priority: string;
  status: string;
  taskTotal: number;
  taskDone: number;
};

export type BoardColumnView = {
  status: string;
  label: string;
  stories: BoardStoryView[];
};

export type TeamBoardView = {
  teams: { id: string; name: string }[];
  selectedTeamId: string | null;
  sprints: { id: string; name: string; status: string }[];
  selectedSprintId: string | null;
  columns: BoardColumnView[];
};

type BoardInput = { teamId?: string; sprintId?: string };

export async function getTeamBoard(
  input: BoardInput = {}
): Promise<Result<TeamBoardView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const teams = await database.team.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    // teamId vem do cliente: só é aceito se estiver na lista do tenant. Sem
    // isso, um id de outro tenant escolheria as sprints de lá.
    const selectedTeamId =
      teams.find((t) => t.id === input.teamId)?.id ?? teams[0]?.id ?? null;

    const vazio: TeamBoardView = {
      teams,
      selectedTeamId,
      sprints: [],
      selectedSprintId: null,
      columns: COLUNAS.map((c) => ({ ...c, stories: [] })),
    };

    if (!selectedTeamId) {
      return vazio;
    }

    const sprints = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, teamId: selectedTeamId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, status: true },
    });

    // Mesma regra do id do time: sprint do cliente só vale se for deste time.
    // O default é a sprint ativa — é a iteração que o time está executando —
    // caindo para a primeira quando nenhuma está ativa.
    const selectedSprintId =
      sprints.find((s) => s.id === input.sprintId)?.id ??
      sprints.find((s) => s.status === "ACTIVE")?.id ??
      sprints[0]?.id ??
      null;

    if (!selectedSprintId) {
      return { ...vazio, sprints, selectedSprintId: null };
    }

    const stories = await database.story.findMany({
      where: { tenantId: ctx.tenantId, sprintId: selectedSprintId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        storyPoints: true,
        priority: true,
        status: true,
        tasks: { select: { status: true } },
      },
    });

    const columns = COLUNAS.map((coluna) => ({
      status: coluna.status,
      label: coluna.label,
      stories: stories
        .filter((s) => s.status === coluna.status)
        .map((s) => ({
          id: s.id,
          title: s.title,
          storyPoints: s.storyPoints,
          priority: s.priority,
          status: s.status,
          taskTotal: s.tasks.length,
          taskDone: s.tasks.filter((t) => t.status === "DONE").length,
        })),
    }));

    return { teams, selectedTeamId, sprints, selectedSprintId, columns };
  });
}
