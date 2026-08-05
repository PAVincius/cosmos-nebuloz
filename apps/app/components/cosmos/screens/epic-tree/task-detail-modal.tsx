"use client";

import { Badge } from "@repo/design-system/cosmos/kit";
import {
  PROVIDERS,
  TASK_STATUSES,
  type TaskNode,
} from "@/app/(cosmos)/actions/epic-tree.constants";
import { ModalCard } from "../../modal";

export function TaskDetailModal({ task }: { task: TaskNode }) {
  const provider = task.externalSource
    ? PROVIDERS[task.externalSource]
    : undefined;
  const label = provider?.label ?? task.externalSource ?? "ferramenta externa";
  const ref = task.externalId ?? task.id;
  // externalUrl gravado pelo sync tem precedência; buildUrl é só o fallback.
  const url = task.externalUrl ?? provider?.buildUrl(ref) ?? null;
  const status = TASK_STATUSES.find((s) => s.id === task.status);

  return (
    <ModalCard subtitle={`${label} · ${ref}`} title={task.title} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <Field
            label="Responsável"
            value={task.assigneeName ?? "Não atribuído"}
          />
          <Field
            label="Estimativa"
            value={task.estimateHours === null ? "—" : `${task.estimateHours}h`}
          />
        </div>

        {status && (
          <div>
            <Badge dot tone={status.tone}>
              {status.label}
            </Badge>
          </div>
        )}

        <p
          style={{
            display: "flex",
            gap: 8,
            margin: 0,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ink-muted)",
            background: "var(--surface-3)",
            borderRadius: "var(--r-md)",
          }}
        >
          <span aria-hidden="true">🔒</span>
          Este item é mantido no {label}. A edição acontece na ferramenta de
          origem — o Cosmos apenas sincroniza e exibe.
        </p>

        {url && (
          <a
            href={url}
            rel="noreferrer noopener"
            style={{
              alignSelf: "flex-start",
              fontSize: 12.5,
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline)",
              background: "var(--surface)",
              color: "var(--ink)",
              textDecoration: "none",
            }}
            target="_blank"
          >
            Abrir no {label} ↗
          </a>
        )}
      </div>
    </ModalCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "9px 11px",
        background: "var(--surface-3)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
