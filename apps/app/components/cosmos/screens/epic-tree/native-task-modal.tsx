"use client";

import { ErrorState } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { updateNativeTask } from "@/app/(cosmos)/actions/epic-tree";
import {
  DEFAULT_NOTE_BLOCKS,
  TASK_STATUSES,
  type TaskBlock,
  type TaskNode,
} from "@/app/(cosmos)/actions/epic-tree.constants";
import { ModalCard } from "../../modal";
import { BlockRenderer, BlockToolbar, emptyBlock } from "./blocks";

export function NativeTaskModal({
  task,
  onSaved,
}: {
  task: TaskNode;
  onSaved: (next: TaskNode) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
  const [blocks, setBlocks] = useState<TaskBlock[]>(
    task.blocks ?? DEFAULT_NOTE_BLOCKS
  );
  const [error, setError] = useState<string | null>(null);

  async function persist(next: {
    title?: string;
    status?: string;
    blocks?: TaskBlock[];
  }) {
    setError(null);
    const res = await updateNativeTask({ taskId: task.id, ...next });
    if (res.ok) {
      // updateNativeTask não resolve nome de responsável (evita um join a
      // cada autosave); preservamos o que a linha já carregava.
      onSaved({ ...res.data, assigneeName: task.assigneeName });
    } else {
      setError(res.error);
    }
  }

  function commitBlocks(next: TaskBlock[]) {
    setBlocks(next);
    persist({ blocks: next });
  }

  return (
    <ModalCard
      subtitle="Criada e mantida dentro da plataforma — sem dependência de ferramenta externa"
      title="Nota da task"
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <ErrorState message={error} />}

        <input
          aria-label="Título da task"
          onBlur={() => persist({ title })}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            fontSize: 15,
            fontWeight: 700,
            padding: "8px 10px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
          value={title}
        />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div
            style={{
              padding: "9px 11px",
              background: "var(--surface-3)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              Responsável
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink)" }}>
              {task.assigneeName ?? "Não atribuído"}
            </div>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              Status
            </span>
            <select
              onChange={(e) => {
                setStatus(e.target.value);
                persist({ status: e.target.value });
              }}
              style={{
                fontSize: 12.5,
                padding: 7,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
              value={status}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {blocks.map((block, idx) => (
            <BlockRenderer
              block={block}
              key={block.id}
              onChange={(next) =>
                commitBlocks(blocks.map((b, i) => (i === idx ? next : b)))
              }
              onRemove={() => commitBlocks(blocks.filter((_, i) => i !== idx))}
            />
          ))}
        </div>

        <BlockToolbar
          onAdd={(kind) => commitBlocks([...blocks, emptyBlock(kind)])}
        />

        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          esc fechar · autosave ao editar
        </span>
      </div>
    </ModalCard>
  );
}
