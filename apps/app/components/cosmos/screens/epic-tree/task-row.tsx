"use client";

import { Avatar, Badge, useNav } from "@repo/design-system/cosmos/kit";
import {
  PROVIDERS,
  TASK_STATUSES,
  type TaskNode,
} from "@/app/(cosmos)/actions/epic-tree.constants";

const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

// Ref exibida: o id externo quando existe, senão o id interno encurtado.
function taskRef(task: TaskNode): string {
  return task.externalId ?? task.id.slice(0, 8);
}

export function TaskRow({
  task,
  connected,
  onOpenExternal,
  onOpenNative,
}: {
  task: TaskNode;
  connected: boolean;
  onOpenExternal: (task: TaskNode) => void;
  onOpenNative: (task: TaskNode) => void;
}) {
  const { navigate } = useNav();
  const provider = task.externalSource
    ? PROVIDERS[task.externalSource]
    : undefined;
  const isNative = task.externalSource === null;
  const originLabel = isNative
    ? "Cosmos (nativa)"
    : (provider?.label ?? task.externalSource);
  const status = TASK_STATUSES.find((s) => s.id === task.status);
  // Externa de um provider desconhecido nunca é tratada como conectada.
  const externalConnected = connected && provider !== undefined;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-sm)",
        opacity: isNative || externalConnected ? 1 : 0.6,
      }}
    >
      <span style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={task.assigneeName ?? "—"} size={20} />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -3,
            right: -3,
            width: 13,
            height: 13,
            borderRadius: "50%",
            border: "1.5px solid var(--surface)",
            display: "grid",
            placeItems: "center",
            fontSize: 8,
            fontWeight: 700,
            background: `var(--${isNative ? "green" : (provider?.tone ?? "neutral")}-bg)`,
            color: `var(--${isNative ? "green" : (provider?.tone ?? "neutral")}-text)`,
          }}
          title={`Origem: ${originLabel}`}
        >
          {isNative ? "C" : (provider?.letter ?? "?")}
        </span>
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </span>
        <span style={SR_ONLY}>Origem: {originLabel}</span>
      </span>

      {status && (
        <Badge dot tone={status.tone}>
          {status.label}
        </Badge>
      )}

      {isNative && (
        <button
          onClick={() => onOpenNative(task)}
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: "4px 9px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--green-text)",
            cursor: "pointer",
          }}
          type="button"
        >
          Abrir nota
        </button>
      )}

      {!isNative && externalConnected && (
        <button
          className="mono"
          onClick={() => onOpenExternal(task)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 9px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--ink-muted)",
            cursor: "pointer",
          }}
          type="button"
        >
          {taskRef(task)} ↗
        </button>
      )}

      {!(isNative || externalConnected) && (
        <button
          onClick={() => navigate("integrations")}
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: "4px 9px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--amber-border)",
            background: "var(--amber-bg)",
            color: "var(--amber-text)",
            cursor: "pointer",
          }}
          type="button"
        >
          {originLabel} não conectado · Conectar
        </button>
      )}
    </div>
  );
}
