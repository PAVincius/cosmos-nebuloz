"use client";

import { useRef } from "react";
import type {
  ChecklistItem,
  TaskBlock,
} from "@/app/(cosmos)/actions/epic-tree.constants";

// contentEditable com commit no blur: o React não controla o conteúdo (isso
// destruiria o cursor a cada tecla), então o valor só sobe quando o campo
// perde o foco.
export function EditableText({
  value,
  onCommit,
  style,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  style?: React.CSSProperties;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    // biome-ignore lint/a11y/useSemanticElements: contentEditable div by design (see comment above) — a native input/textarea would be controlled and destroy the caret on every keystroke
    <div
      aria-label={ariaLabel}
      contentEditable
      onBlur={() => {
        const next = ref.current?.innerText ?? "";
        if (next !== value) {
          onCommit(next);
        }
      }}
      ref={ref}
      role="textbox"
      style={{ outline: "none", ...style }}
      suppressContentEditableWarning
      tabIndex={0}
    >
      {value}
    </div>
  );
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function BlockRenderer({
  block,
  onChange,
  onRemove,
}: {
  block: TaskBlock;
  onChange: (next: TaskBlock) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="block-hover"
      style={{ position: "relative", padding: "4px 26px 4px 0" }}
    >
      <button
        aria-label="Remover bloco"
        className="block-remove"
        onClick={onRemove}
        style={{
          position: "absolute",
          top: 4,
          right: 0,
          width: 20,
          height: 20,
          borderRadius: 5,
          border: "1px solid var(--hairline)",
          background: "var(--surface-2)",
          color: "var(--ink-faint)",
          cursor: "pointer",
          fontSize: 12,
          lineHeight: 1,
        }}
        type="button"
      >
        ×
      </button>

      {block.kind === "heading" && (
        <EditableText
          ariaLabel="Título do bloco"
          onCommit={(text) => onChange({ ...block, text })}
          style={{ fontSize: 16.5, fontWeight: 700 }}
          value={block.text}
        />
      )}

      {block.kind === "paragraph" && (
        <EditableText
          ariaLabel="Texto do bloco"
          onCommit={(text) => onChange({ ...block, text })}
          style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-muted)" }}
          value={block.text}
        />
      )}

      {block.kind === "code" && (
        <EditableText
          ariaLabel="Código do bloco"
          onCommit={(text) => onChange({ ...block, text })}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            background: "var(--surface-3)",
            borderRadius: "var(--r-sm)",
            padding: "8px 10px",
          }}
          value={block.text}
        />
      )}

      {block.kind === "checklist" && (
        <ChecklistBlock block={block} onChange={onChange} />
      )}
    </div>
  );
}

function ChecklistBlock({
  block,
  onChange,
}: {
  block: Extract<TaskBlock, { kind: "checklist" }>;
  onChange: (next: TaskBlock) => void;
}) {
  const done = block.items.filter((i) => i.done).length;

  function replaceItem(id: string, next: Partial<ChecklistItem>) {
    onChange({
      ...block,
      items: block.items.map((i) => (i.id === id ? { ...i, ...next } : i)),
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)" }}
        >
          Sub-tasks
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            padding: "2px 7px",
            borderRadius: 999,
            background: "var(--surface-3)",
            color: "var(--ink-faint)",
          }}
        >
          {done}/{block.items.length}
        </span>
      </div>

      {block.items.map((item, index) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "3px 0",
          }}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: custom circular toggle kept as a button with explicit checkbox role and aria-checked; a restyled native input would also work and is the better long-term option */}
          <button
            aria-checked={item.done}
            aria-label={item.text || `Sub-task ${index + 1}`}
            onClick={() => replaceItem(item.id, { done: !item.done })}
            role="checkbox"
            style={{
              width: 17,
              height: 17,
              flexShrink: 0,
              borderRadius: "50%",
              border: `1.5px solid var(--${item.done ? "accent" : "hairline-strong"})`,
              background: item.done ? "var(--accent)" : "transparent",
              cursor: "pointer",
            }}
            type="button"
          />
          <EditableText
            ariaLabel="Texto da sub-task"
            onCommit={(text) => replaceItem(item.id, { text })}
            style={{
              fontSize: 12.5,
              color: item.done ? "var(--ink-faint)" : "var(--ink)",
              textDecoration: item.done ? "line-through" : "none",
              flex: 1,
            }}
            value={item.text}
          />
        </div>
      ))}

      <button
        onClick={() =>
          onChange({
            ...block,
            items: [
              ...block.items,
              { id: newId("item"), text: "", done: false },
            ],
          })
        }
        style={{
          marginTop: 4,
          fontSize: 11.5,
          border: "none",
          background: "transparent",
          color: "var(--accent-text)",
          cursor: "pointer",
          padding: 0,
        }}
        type="button"
      >
        + item
      </button>
    </div>
  );
}

const BLOCK_LABELS: { kind: TaskBlock["kind"]; label: string }[] = [
  { kind: "heading", label: "Título" },
  { kind: "paragraph", label: "Texto" },
  { kind: "checklist", label: "Checklist" },
  { kind: "code", label: "Código" },
];

export function BlockToolbar({
  onAdd,
}: {
  onAdd: (kind: TaskBlock["kind"]) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        paddingTop: 10,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {BLOCK_LABELS.map((b) => (
        <button
          key={b.kind}
          onClick={() => onAdd(b.kind)}
          style={{
            fontSize: 11.5,
            padding: "4px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--ink-muted)",
            cursor: "pointer",
          }}
          type="button"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function emptyBlock(kind: TaskBlock["kind"]): TaskBlock {
  if (kind === "checklist") {
    return { id: newId("block"), kind, items: [] };
  }
  return { id: newId("block"), kind, text: "" };
}
