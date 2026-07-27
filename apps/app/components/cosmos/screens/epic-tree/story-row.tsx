"use client";

import { useState } from "react";
import {
  createNativeTask,
  listStoryTasks,
} from "@/app/(cosmos)/actions/epic-tree";
import {
  STORY_STATUS_TONE,
  type StoryNode,
  type TaskNode,
} from "@/app/(cosmos)/actions/epic-tree.constants";
import { Badge, Skel } from "../../kit";
import { useModal } from "../../modal";
import { NativeTaskModal } from "./native-task-modal";
import { TaskDetailModal } from "./task-detail-modal";
import { TaskRow } from "./task-row";

export function StoryRow({ story }: { story: StoryNode }) {
  const { open } = useModal();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskNode[] | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const panelId = `story-tasks-${story.id}`;

  async function load() {
    setLoading(true);
    setError(null);
    const res = await listStoryTasks(story.id);
    setLoading(false);
    if (res.ok) {
      setTasks(res.data.tasks);
      setConnected(res.data.connectedSources);
    } else {
      setError(res.error);
    }
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    // Fetch lazy por nível: a árvore inteira nunca é carregada de uma vez.
    if (next && tasks === null && !loading) {
      load();
    }
  }

  function replaceTask(next: TaskNode) {
    setTasks((cur) =>
      cur ? cur.map((t) => (t.id === next.id ? next : t)) : cur
    );
  }

  async function addNativeTask() {
    setCreating(true);
    setError(null);
    const res = await createNativeTask({
      storyId: story.id,
      title: "Nova task",
    });
    setCreating(false);
    if (res.ok) {
      setTasks((cur) => [...(cur ?? []), res.data]);
    } else {
      setError(res.error);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--hairline)" }}>
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={toggle}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 90px 60px",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "9px 14px 9px 34px",
          background: "var(--surface-2)",
          border: "none",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
        type="button"
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Chevron open={expanded} />
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-faint)" }}
            >
              {story.id.slice(0, 8)}
            </span>
            <span
              style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
            >
              {story.title}
            </span>
          </div>
          {story.acceptanceCriteria && (
            <div
              style={{
                fontSize: 11.5,
                fontStyle: "italic",
                color: "var(--ink-faint)",
                paddingLeft: 19,
              }}
            >
              AC: {story.acceptanceCriteria}
            </div>
          )}
        </div>

        <Badge dot tone={STORY_STATUS_TONE[story.status] ?? "neutral"}>
          {story.status}
        </Badge>

        <span
          className="mono"
          style={{
            fontSize: 11.5,
            color: "var(--ink-muted)",
            textAlign: "right",
          }}
        >
          {story.storyPoints} pt
        </span>
      </button>

      <div
        hidden={!expanded}
        id={panelId}
        style={{
          padding: "8px 14px 10px 58px",
          background: "var(--surface-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Tasks operacionais
          </span>
          <button
            disabled={creating}
            onClick={addNativeTask}
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              border: "none",
              background: "transparent",
              color: "var(--green-text)",
              cursor: creating ? "default" : "pointer",
            }}
            type="button"
          >
            {creating ? "Criando…" : "+ Nova task nativa"}
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skel h={30} />
            <Skel h={30} />
          </div>
        )}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--red-text)" }}>
              {error}
            </span>
            <button
              onClick={load}
              style={{
                fontSize: 11.5,
                padding: "3px 9px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!(loading || error) && tasks?.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            Nenhuma task nesta story.
          </span>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks?.map((t) => (
            <TaskRow
              connected={
                t.externalSource === null ||
                connected.includes(t.externalSource)
              }
              key={t.id}
              onOpenExternal={(task) => open(<TaskDetailModal task={task} />)}
              onOpenNative={(task) =>
                open(<NativeTaskModal onSaved={replaceTask} task={task} />)
              }
              task={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="tree-chevron"
      style={{
        display: "inline-block",
        fontSize: 12,
        color: "var(--ink-faint)",
        transform: open ? "rotate(90deg)" : "none",
      }}
    >
      ›
    </span>
  );
}
