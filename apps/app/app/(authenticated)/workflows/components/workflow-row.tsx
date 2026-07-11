import { Workflow, Zap } from "lucide-react";
import Link from "next/link";
import { WorkflowToggle } from "./workflow-toggle";

export type WorkflowTone = "green" | "red" | "amber" | "blue" | "purple" | "accent";

export type WorkflowRowData = {
  /** Team id — also the BpmnDefinition ownerId and the row's nav target. */
  id: string;
  /** Display code, e.g. "WF-01" (derived from list position, not stored). */
  code: string;
  name: string;
  trigger: string | null;
  actionCount: number;
  runCount: number;
  active: boolean;
  tone: WorkflowTone;
  definitionId: string | null;
};

export type WorkflowRowProps = {
  row: WorkflowRowData;
  actorId: string;
};

/** One automation row: icon, name, trigger, action count, run count, toggle. */
export function WorkflowRow({ row, actorId }: WorkflowRowProps) {
  return (
    <div
      className="lift grid items-center gap-4"
      style={{
        gridTemplateColumns: "40px minmax(0,1.5fr) minmax(0,1fr) 84px 80px 46px",
        padding: "14px 18px",
        borderRadius: "var(--cosmos-r-md, 8px)",
        border: "1px solid var(--hairline)",
        background: row.active ? "var(--surface)" : "var(--surface-2)",
        opacity: row.active ? 1 : 0.72,
      }}
    >
      <Link className="contents" href={`/workflows/${row.id}/bpmn`}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
            borderRadius: "var(--cosmos-r-md, 8px)",
            color: `var(--${row.tone})`,
            background: `var(--${row.tone}-soft)`,
            border: `1px solid rgba(var(--${row.tone}-rgb),.22)`,
          }}
        >
          <Workflow size={17} strokeWidth={2} />
        </span>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="font-mono"
              style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}
            >
              {row.code}
            </span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.name}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Zap size={13} style={{ color: "var(--amber)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.trigger ?? "Gatilho não configurado"}
          </span>
        </div>

        <div style={{ textAlign: "center" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-muted)",
              background: "var(--chip-bg)",
              border: "1px solid var(--hairline)",
              borderRadius: 99,
              padding: "3px 10px",
            }}
          >
            {row.actionCount} ação{row.actionCount > 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            className="font-mono"
            style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}
          >
            {row.runCount}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--ink-subtle)",
              fontWeight: 600,
              letterSpacing: ".03em",
            }}
          >
            EXECUÇÕES
          </div>
        </div>
      </Link>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <WorkflowToggle
          actorId={actorId}
          active={row.active}
          definitionId={row.definitionId}
          tone={row.tone}
        />
      </div>
    </div>
  );
}
