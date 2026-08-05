"use client";

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Badge, useNav } from "@repo/design-system/cosmos/kit";
// copilot-parts.tsx — renders the non-text parts of a streamed assistant
// UIMessage as "insight cards": real tool outputs from api/copilot/chat's
// buildCopilotTools (tools.ts), never fabricated data. submitSuggestion and
// submitReport get dedicated cards; every other tool call collapses to a
// small status chip so the transcript stays readable.
//
// Known gap (see track1 report): submitSuggestion's navigate_to routes
// (e.g. "/portfolio/wsjf", "/epics/[id]") belong to a route scheme this app
// never built — only the /cosmos/<id> registry exists. mapRouteToScreen()
// best-effort maps the routes that do correspond to a registered screen;
// anything else renders as plain text, never a button that would silently
// no-op or land on a misleading "coming soon" page.
import { useState } from "react";
import {
  applySuggestion,
  createCopilotSuggestion,
  discardSuggestion,
} from "@/app/actions/safe-copilot";

type ToolPart = {
  type: string;
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type TextPart = { type: "text"; text: string };

// Structural — matches ai@5 UIMessagePart closely enough for this renderer
// without importing its full generic tool typing (which requires the
// server-only tool definitions to resolve concretely).
export type RenderablePart =
  | TextPart
  | ToolPart
  | { type: string; [k: string]: unknown };

function isToolPart(part: RenderablePart): part is ToolPart {
  return part.type.startsWith("tool-") && "state" in part;
}

const SUGGESTION_ICON: Record<string, IconName> = {
  navigate_to: "arrowRight",
  create_pi_objectives: "flag",
  create_risks: "alert",
  flag_dependencies: "gitBranch",
  create_improvement_action: "zap",
};

const TOOL_LABELS: Record<string, string> = {
  queryFlowMetrics: "métricas de flow",
  queryLeanBudget: "lean budget",
  queryProgramBoard: "program board",
  queryKnowledge: "base de conhecimento",
  queryARTs: "ARTs",
  queryTeams: "times",
  queryEpics: "épicos",
  queryOKRs: "OKRs",
  estimateAwsCost: "custo AWS",
  estimateGcpCost: "custo GCP",
  createFeature: "criação de feature",
  moveFeature: "movimentação de feature",
};

// Routes the copilot's navigate_to tool can suggest (prompts/index.ts) that
// have a real counterpart in the /cosmos/<id> screen registry. Everything
// else is a known gap — rendered as plain text, not a dead button.
function mapRouteToScreen(
  route: string
): { id: string; param?: string } | null {
  const clean = route.split("?")[0]?.replace(/\/$/, "") ?? route;
  const teamMatch = clean.match(/^\/teams\/([^/]+)$/);
  if (teamMatch) {
    return { id: "team", param: teamMatch[1] };
  }
  const epicMatch = clean.match(/^\/epics\/([^/]+)$/);
  if (epicMatch) {
    return { id: "epic", param: epicMatch[1] };
  }
  const table: Record<string, string> = {
    "/portfolio/wsjf": "wsjf",
    "/portfolio/okrs": "okrs",
    "/portfolio/budgets": "budgets",
    "/teams": "teams",
    "/risks": "risks",
    "/dependencies": "dependencies",
    "/analytics/flow": "flow",
    "/analytics/velocity": "velocity",
  };
  const id = table[clean];
  return id ? { id } : null;
}

// createCopilotSuggestion's SuggestionType union isn't exported from
// app/actions/safe-copilot — derive the parameter type instead of importing
// an unexported symbol. The function validates at runtime anyway.
type SuggestionTypeArg = Parameters<typeof createCopilotSuggestion>[1];

function SuggestionCard({
  toolOutput,
  sessionId,
}: {
  toolOutput: { type: string; payload: Record<string, unknown> };
  sessionId: string | null;
}) {
  const { navigate, isComingSoon } = useNav();
  const [status, setStatus] = useState<
    "idle" | "applying" | "applied" | "discarding" | "discarded"
  >("idle");
  const { type, payload } = toolOutput;
  const icon = SUGGESTION_ICON[type] ?? "sparkles";

  async function handleApply() {
    if (!sessionId || status !== "idle") {
      return;
    }
    setStatus("applying");
    try {
      const { id } = await createCopilotSuggestion(
        sessionId,
        type as SuggestionTypeArg,
        payload
      );
      await applySuggestion(id);
      setStatus("applied");
    } catch {
      setStatus("idle");
    }
  }

  async function handleDiscard() {
    if (!sessionId || status !== "idle") {
      return;
    }
    setStatus("discarding");
    try {
      const { id } = await createCopilotSuggestion(
        sessionId,
        type as SuggestionTypeArg,
        payload
      );
      await discardSuggestion(id);
      setStatus("discarded");
    } catch {
      setStatus("idle");
    }
  }

  if (type === "navigate_to") {
    const route = typeof payload.route === "string" ? payload.route : "";
    const label = typeof payload.label === "string" ? payload.label : route;
    const mapped = route ? mapRouteToScreen(route) : null;
    const actionable = mapped && !isComingSoon(mapped.id);
    return (
      <div
        className="lift"
        style={{
          display: "flex",
          gap: 13,
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
          borderLeft: "3px solid var(--accent)",
          padding: "12px 14px",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
            color: "var(--accent)",
            background: "var(--accent-soft)",
          }}
        >
          <Icon name={icon} size={15} strokeWidth={2} />
        </span>
        <div
          style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ink)" }}
        >
          {label}
        </div>
        {actionable ? (
          <button
            className="btn"
            onClick={() => navigate(mapped.id, mapped.param)}
            style={{
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline)",
              background: "var(--surface)",
              color: "var(--accent)",
              cursor: "pointer",
            }}
            type="button"
          >
            Abrir
          </button>
        ) : (
          <span
            className="mono"
            style={{ flexShrink: 0, fontSize: 10.5, color: "var(--ink-faint)" }}
          >
            {route || "rota indisponível"}
          </span>
        )}
      </div>
    );
  }

  const items = Array.isArray(payload.items)
    ? (payload.items as { title?: string }[])
    : [];

  return (
    <div
      className="lift"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        borderLeft: "3px solid var(--purple)",
        padding: "13px 14px",
      }}
    >
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
            color: "var(--purple)",
            background: "var(--purple-soft)",
          }}
        >
          <Icon name={icon} size={15} strokeWidth={2} />
        </span>
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {items.map((it, i) => (
            <span
              key={`${it.title}-${i}`}
              style={{ fontSize: 13, color: "var(--ink)" }}
            >
              {it.title ?? "—"}
            </span>
          ))}
          {items.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Sugestão sem itens.
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {status === "applied" ? (
          <Badge tone="green">Aplicada nesta sessão</Badge>
        ) : status === "discarded" ? (
          <Badge tone="neutral">Descartada</Badge>
        ) : (
          <>
            <button
              className="btn"
              disabled={!sessionId || status !== "idle"}
              onClick={handleApply}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
                color: "var(--ink)",
                cursor: sessionId ? "pointer" : "default",
              }}
              type="button"
            >
              {status === "applying" ? "Aplicando…" : "Aplicar"}
            </button>
            <button
              className="btn"
              disabled={!sessionId || status !== "idle"}
              onClick={handleDiscard}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "transparent",
                color: "var(--ink-muted)",
                cursor: sessionId ? "pointer" : "default",
              }}
              type="button"
            >
              {status === "discarding" ? "Descartando…" : "Descartar"}
            </button>
            <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              registra a decisão nesta sessão
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function downloadCsv(
  title: string,
  columns: string[],
  rows: (string | number | null)[][]
) {
  const csvEscape = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    columns.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "relatorio"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportCard({
  report,
}: {
  report: {
    title: string;
    columns: string[];
    rows: (string | number | null)[][];
  };
}) {
  return (
    <div
      className="lift"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        borderLeft: "3px solid var(--blue)",
        padding: "13px 14px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          {report.title}
        </span>
        <button
          className="btn"
          onClick={() => downloadCsv(report.title, report.columns, report.rows)}
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hairline)",
            background: "transparent",
            color: "var(--ink-muted)",
            cursor: "pointer",
          }}
          type="button"
        >
          Exportar CSV
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
        >
          <thead>
            <tr>
              {report.columns.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    color: "var(--ink-faint)",
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: "6px 10px",
                      color: "var(--ink-muted)",
                      borderBottom: "1px solid var(--hairline)",
                    }}
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenericToolChip({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");
  const label = TOOL_LABELS[name] ?? name;
  const done =
    part.state === "output-available" || part.state === "output-error";
  const failed = part.state === "output-error";

  // Write tools the user should see the real outcome of, not just a chip.
  if (
    (name === "createFeature" || name === "moveFeature") &&
    part.state === "output-available"
  ) {
    const out = part.output as
      | {
          ok?: boolean;
          error?: string;
          feature?: { title?: string; wsjfScore?: number; statusId?: string };
        }
      | undefined;
    if (out?.ok === false) {
      return <Badge tone="red">{out.error ?? "Ação não realizada."}</Badge>;
    }
    if (out?.ok && out.feature) {
      return (
        <Badge tone="green">
          {name === "createFeature"
            ? `Feature criada: ${out.feature.title}`
            : `Feature movida: ${out.feature.title} → ${out.feature.statusId}`}
        </Badge>
      );
    }
  }
  if (failed) {
    return <Badge tone="red">{`Falha ao consultar ${label}`}</Badge>;
  }

  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10.5,
        color: "var(--ink-faint)",
      }}
    >
      <Icon name={done ? "check" : "refresh"} size={11} />
      {done ? `consultado: ${label}` : `consultando ${label}…`}
    </span>
  );
}

export function MessagePartsView({
  parts,
  sessionId,
}: {
  parts: RenderablePart[];
  sessionId: string | null;
}) {
  const textParts = parts.filter((p): p is TextPart => p.type === "text");
  const text = textParts.map((p) => p.text).join("");
  const otherParts = parts.filter(
    (p) => p.type !== "text" && p.type !== "step-start"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {text && (
        <div
          style={{
            fontSize: 14,
            color: "var(--ink)",
            fontWeight: 500,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      )}
      {otherParts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {otherParts.map((part) => {
            if (!isToolPart(part)) {
              return null;
            }
            if (
              part.type === "tool-submitSuggestion" &&
              part.state === "output-available"
            ) {
              return (
                <SuggestionCard
                  key={part.toolCallId}
                  sessionId={sessionId}
                  toolOutput={
                    part.output as {
                      type: string;
                      payload: Record<string, unknown>;
                    }
                  }
                />
              );
            }
            if (
              part.type === "tool-submitReport" &&
              part.state === "output-available"
            ) {
              return (
                <ReportCard
                  key={part.toolCallId}
                  report={
                    part.output as {
                      title: string;
                      columns: string[];
                      rows: (string | number | null)[][];
                    }
                  }
                />
              );
            }
            return <GenericToolChip key={part.toolCallId} part={part} />;
          })}
        </div>
      )}
    </div>
  );
}
