"use client";

// copilot-sessions.tsx — session rail for the copilot screen. Thin UI over
// the existing mature layer (app/actions/safe-copilot/sessions.ts): create,
// select, pin/unpin, rename (double-click), and delete. No new persistence.
import { useState } from "react";
import {
  deleteCopilotSession,
  pinCopilotSession,
  renameCopilotSession,
  type SessionPreview,
  unpinCopilotSession,
} from "@/app/actions/safe-copilot/sessions";
import { Icon } from "../icons";

export function CopilotSessionRail({
  sessions,
  activeId,
  onSelect,
  onNew,
  onChanged,
}: {
  sessions: SessionPreview[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function togglePin(s: SessionPreview) {
    if (s.pinnedAt) {
      await unpinCopilotSession(s.id);
    } else {
      await pinCopilotSession(s.id);
    }
    onChanged();
  }

  async function remove(id: string) {
    await deleteCopilotSession(id);
    onChanged();
  }

  async function commitRename(id: string) {
    const title = editValue.trim();
    setEditingId(null);
    if (title) {
      await renameCopilotSession(id, title);
      onChanged();
    }
  }

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <button
        className="btn"
        onClick={onNew}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          fontWeight: 600,
          padding: "8px 12px",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--hairline-strong)",
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
        }}
        type="button"
      >
        <Icon name="plus" size={14} />
        Nova conversa
      </button>
      <div
        className="scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {sessions.length === 0 && (
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-faint)",
              padding: "8px 6px",
            }}
          >
            Nenhuma conversa ainda.
          </span>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderRadius: "var(--r-md)",
              background:
                activeId === s.id ? "var(--accent-soft)" : "transparent",
            }}
          >
            {editingId === s.id ? (
              <input
                autoFocus
                onBlur={() => commitRename(s.id)}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitRename(s.id);
                  } else if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  padding: "7px 8px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline-strong)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                }}
                value={editValue}
              />
            ) : (
              <button
                className="btn"
                onClick={() => onSelect(s.id)}
                onDoubleClick={() => {
                  setEditingId(s.id);
                  setEditValue(s.preview);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  fontSize: 12.5,
                  fontWeight: activeId === s.id ? 600 : 500,
                  color:
                    activeId === s.id ? "var(--accent)" : "var(--ink-muted)",
                  background: "none",
                  border: "none",
                  padding: "7px 8px",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
                title="Clique para abrir · duplo clique para renomear"
                type="button"
              >
                {s.preview}
              </button>
            )}
            <button
              className="btn"
              onClick={() => togglePin(s)}
              style={{
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                width: 24,
                height: 24,
                background: "none",
                border: "none",
                color: s.pinnedAt ? "var(--amber-text)" : "var(--ink-faint)",
                cursor: "pointer",
              }}
              title={s.pinnedAt ? "Desafixar" : "Fixar"}
              type="button"
            >
              <Icon name="star" size={12} />
            </button>
            <button
              className="btn"
              onClick={() => remove(s.id)}
              style={{
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                width: 24,
                height: 24,
                background: "none",
                border: "none",
                color: "var(--ink-faint)",
                cursor: "pointer",
              }}
              title="Excluir"
              type="button"
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
