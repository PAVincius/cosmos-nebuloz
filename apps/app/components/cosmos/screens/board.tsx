"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  useNav,
} from "@repo/design-system/cosmos/kit";
// board.tsx — Board do Time (story-060). Primeira tela do Cosmos no nível Team:
// as 38 telas anteriores param no ART. Aqui mora o Team Backlog e a Iteration
// Execution do SAFe 6.0 — story em coluna, task dentro da story.
//
// Nada de backend novo. createStory/updateStoryStatus (app/actions/stories) e
// createTask/listTasksByStory/updateTaskStatus (app/actions/tasks) já existiam,
// completos e sem um único chamador. As de task não tinham teste algum até
// __tests__/actions/tasks/tasks.test.ts, escrito com esta história.
//
// Sem drag-and-drop de propósito: a transição é um <select> por story, o que
// cumpre o AC-003, funciona no teclado e não esconde a regra atrás de um gesto.
import { useCallback, useEffect, useState } from "react";
import type {
  BoardStoryView,
  TeamBoardView,
} from "@/app/(cosmos)/actions/board";
import { getTeamBoard } from "@/app/(cosmos)/actions/board";
import { COLUNAS } from "@/app/(cosmos)/actions/board.constants";
import { createStory, updateStoryStatus } from "@/app/actions/stories";
import {
  createTask,
  listTasksByStory,
  updateTaskStatus,
} from "@/app/actions/tasks";
import { EmptyState } from "../empty-state";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const controlStyle = {
  padding: "8px 10px",
  fontSize: 13,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
} as const;

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 4,
} as const;

const PRIORITY_TONE: Record<string, "red" | "amber" | "neutral"> = {
  critical: "red",
  high: "amber",
  medium: "neutral",
  low: "neutral",
};

type TaskView = { id: string; title: string; status: string };

// AC-005 — a task só existe dentro de uma story: createTask exige storyId, e
// não há task solta no board.
function TaskList({ story }: { story: BoardStoryView }) {
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [titulo, setTitulo] = useState("");

  const load = useCallback(async () => {
    const res = await listTasksByStory(story.id);
    setTasks(res.ok ? (res.data as TaskView[]) : []);
  }, [story.id]);

  useEffect(() => {
    load();
  }, [load]);

  const adicionar = async () => {
    if (!titulo.trim()) {
      return;
    }
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => createTask({ storyId: story.id, title: titulo.trim() }),
      {
        loading: "Criando task...",
        success: "Task criada.",
        error: (err: string) => `Não foi possível criar a task: ${err}`,
      }
    );
    if (res.ok) {
      setTitulo("");
      load();
    }
  };

  const concluir = async (task: TaskView) => {
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => updateTaskStatus(task.id, "DONE"), {
      loading: "Concluindo task...",
      success: "Task concluída.",
      error: (err: string) => `Não foi possível concluir: ${err}`,
    });
    if (res.ok) {
      load();
    }
  };

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {tasks?.map((task) => (
        <div
          key={task.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 0",
          }}
        >
          <input
            aria-label={`Concluir ${task.title}`}
            checked={task.status === "DONE"}
            disabled={task.status === "DONE"}
            onChange={() => concluir(task)}
            type="checkbox"
          />
          <span
            style={{
              fontSize: 12,
              color:
                task.status === "DONE"
                  ? "var(--ink-faint)"
                  : "var(--ink-subtle)",
              textDecoration: task.status === "DONE" ? "line-through" : "none",
            }}
          >
            {task.title}
          </span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          aria-label={`Nova task em ${story.title}`}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              adicionar();
            }
          }}
          placeholder="Nova task"
          style={{ ...controlStyle, flex: 1, fontSize: 12, padding: "6px 8px" }}
          value={titulo}
        />
        <Button onClick={adicionar} size="sm" variant="secondary">
          Adicionar task
        </Button>
      </div>
    </div>
  );
}

function StoryCard({
  story,
  onChanged,
}: {
  story: BoardStoryView;
  onChanged: () => void;
}) {
  const [aberta, setAberta] = useState(false);

  // AC-003 — updateStoryStatus já carimba startedAt e completedAt na transição.
  // A tela expõe a mudança; não recalcula a regra.
  const mover = async (status: string) => {
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => updateStoryStatus(story.id, status),
      {
        loading: "Movendo story...",
        success: "Story movida.",
        error: (err: string) => `Não foi possível mover: ${err}`,
      }
    );
    if (res.ok) {
      onChanged();
    }
  };

  return (
    <div
      style={{
        padding: 10,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
        {story.title}
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}
      >
        <Badge tone={PRIORITY_TONE[story.priority] ?? "neutral"}>
          {story.storyPoints} SP
        </Badge>
        <button
          aria-label={`Abrir tasks de ${story.title}`}
          onClick={() => setAberta((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--ink-faint)",
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
          }}
          type="button"
        >
          {story.taskDone}/{story.taskTotal} tasks
        </button>
      </div>

      <select
        aria-label={`Estado de ${story.title}`}
        onChange={(e) => mover(e.target.value)}
        style={{ ...controlStyle, width: "100%", marginTop: 6, fontSize: 12 }}
        value={story.status}
      >
        {COLUNAS.map((c) => (
          <option key={c.status} value={c.status}>
            {c.label}
          </option>
        ))}
      </select>

      {aberta && <TaskList story={story} />}
    </div>
  );
}

// AC-004 — a story nasce na sprint selecionada. Criar sem sprintId a deixaria
// fora do próprio board que a criou.
function NovaStoryModal({
  sprintId,
  onCreated,
}: {
  sprintId: string;
  onCreated: () => void;
}) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [storyPoints, setStoryPoints] = useState(1);

  const create = async () => {
    if (!title.trim()) {
      return;
    }
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => createStory({ sprintId, title: title.trim(), storyPoints }),
      {
        loading: "Criando story...",
        success: "Story criada.",
        error: (err: string) => `Não foi possível criar a story: ${err}`,
      }
    );
    if (res.ok) {
      close();
      onCreated();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="kanban" size={16} strokeWidth={2.4} />}
      subtitle="A story entra na sprint selecionada"
      title="Nova story"
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="story-title" style={labelStyle}>
            Título da story
          </label>
          <input
            autoFocus
            id="story-title"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Exportar relatório"
            style={{ ...controlStyle, width: "100%" }}
            value={title}
          />
        </div>
        <div>
          <label htmlFor="story-points" style={labelStyle}>
            Story points
          </label>
          <input
            id="story-points"
            max={100}
            min={0}
            onChange={(e) => setStoryPoints(Number(e.target.value))}
            style={{ ...controlStyle, width: "100%" }}
            type="number"
            value={storyPoints}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar story
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function BoardBody() {
  const modal = useModal();
  const nav = useNav();
  const [data, setData] = useState<TeamBoardView | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [sprintId, setSprintId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    const res = await getTeamBoard({
      ...(teamId && { teamId }),
      ...(sprintId && { sprintId }),
    });
    if (res.ok) {
      setData(res.data);
      setErro(null);
    } else {
      setData(null);
      setErro(res.error);
    }
  }, [teamId, sprintId]);

  useEffect(() => {
    load();
  }, [load]);

  if (erro) {
    return (
      <div>
        <PageHeader title="Board do Time" />
        <ErrorState message={erro} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Board do Time" />
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          Carregando...
        </div>
      </div>
    );
  }

  const semTime = data.teams.length === 0;
  const semSprint = !semTime && data.selectedSprintId === null;

  return (
    <div>
      <PageHeader
        eyebrow="TEAM"
        subtitle="Team Backlog e execução da iteração: story em coluna, task dentro da story."
        title="Board do Time"
      >
        {data.selectedSprintId && (
          <Button
            onClick={() =>
              modal.open(
                <NovaStoryModal
                  onCreated={load}
                  sprintId={data.selectedSprintId as string}
                />
              )
            }
            size="sm"
            variant="primary"
          >
            Nova story
          </Button>
        )}
      </PageHeader>

      {semTime && (
        <EmptyState
          description="O board mostra o trabalho de um time. Crie um time e vincule-o a um ART."
          icon="users"
          title="Nenhum time ainda."
        />
      )}

      {!semTime && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div>
            <label htmlFor="board-team" style={labelStyle}>
              Time
            </label>
            <select
              id="board-team"
              onChange={(e) => {
                // A sprint é do time: trocar de time sem limpar a sprint
                // mandaria um par inválido para o read.
                setTeamId(e.target.value);
                setSprintId(undefined);
              }}
              style={controlStyle}
              value={data.selectedTeamId ?? ""}
            >
              {data.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {data.sprints.length > 0 && (
            <div>
              <label htmlFor="board-sprint" style={labelStyle}>
                Sprint
              </label>
              <select
                id="board-sprint"
                onChange={(e) => setSprintId(e.target.value)}
                style={controlStyle}
                value={data.selectedSprintId ?? ""}
              >
                {data.sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.status}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {semSprint && (
        // AC-002 — a sprint não se cria aqui: ela nasce da cadência do ART em
        // createPIPlanWithSprints. Apontar a origem em vez de oferecer um
        // atalho que o SAFe não tem.
        <EmptyState
          action={{
            label: "Ir para ARTs",
            onClick: () => nav.navigate("arts"),
          }}
          icon="calendar"
          title="Este time não tem sprint. A sprint é gerada com o PI Plan do ART, em ARTs."
        />
      )}

      {!(semTime || semSprint) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${data.columns.length}, minmax(200px, 1fr))`,
            gap: 12,
            alignItems: "start",
            overflowX: "auto",
          }}
        >
          {data.columns.map((coluna) => (
            <div
              data-testid={`coluna-${coluna.status}`}
              key={coluna.status}
              style={{
                padding: 10,
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
                minHeight: 120,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                  }}
                >
                  {coluna.label}
                </span>
                <span
                  data-testid={`contagem-${coluna.status}`}
                  style={{ fontSize: 12, color: "var(--ink-faint)" }}
                >
                  {coluna.stories.length}
                </span>
              </div>

              {coluna.stories.map((story) => (
                <StoryCard key={story.id} onChanged={load} story={story} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoardScreen() {
  return (
    <ModalProvider>
      <BoardBody />
    </ModalProvider>
  );
}
