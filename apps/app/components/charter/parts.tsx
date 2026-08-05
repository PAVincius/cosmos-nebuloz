"use client";

// parts.tsx — componentes de visualização compartilhados entre telas.
// Port de `charter-screens-2.jsx` (RiskMiniMatrix, Heatmap, MitigationTable) e
// `charter-screens-3.jsx` (AuditList).

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Badge, Button } from "@repo/design-system/cosmos/kit";
import { Fragment, useState } from "react";
import type { AuditRow } from "@/app/(charter)/actions/audit";
import type { MitigationRow } from "@/app/(charter)/actions/risk";
import {
  RISK_CATEGORY_LABEL,
  RISK_CATEGORY_TONE,
  type Tone,
} from "@/lib/charter/rules";
import { Legend, TableHead, TableRow } from "./base";

const AXIS = [1, 2, 3, 4, 5];
const ROWS = [5, 4, 3, 2, 1];

function toneFor(score: number): Tone {
  if (score >= 16) {
    return "red";
  }
  if (score >= 9) {
    return "amber";
  }
  return "green";
}

const HEAT_LEGEND = [
  { tone: "green" as Tone, label: "Baixo / moderado (<9)", square: true },
  { tone: "amber" as Tone, label: "Elevado (9–15)", square: true },
  { tone: "red" as Tone, label: "Crítico (≥16)", square: true },
];

// ── RiskMiniMatrix ────────────────────────────────────────────────────────────

/** Plot 5×5 da posição de **um** caso. O alvo marca a célula; as demais ficam
 *  em tom fraco para dar a referência sem competir. */
export function RiskMiniMatrix({ sev, lik }: { sev: number; lik: number }) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "22px repeat(5, 1fr)",
          gap: 4,
        }}
      >
        {ROWS.map((s) => (
          <Fragment key={s}>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {s}
            </span>
            {AXIS.map((l) => {
              const on = s === sev && l === lik;
              const tone = toneFor(s * l);
              return (
                <div
                  key={l}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    background: on
                      ? `var(--${tone})`
                      : `rgba(var(--${tone}-rgb),.10)`,
                    border: `1px solid ${on ? `var(--${tone})` : `rgba(var(--${tone}-rgb),.18)`}`,
                    boxShadow: on
                      ? `0 0 16px rgba(var(--${tone}-rgb),.6)`
                      : "none",
                  }}
                >
                  {on && (
                    <Icon
                      name="target"
                      size={14}
                      strokeWidth={2.4}
                      style={{ color: "var(--accent-fg)" }}
                    />
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
        <span />
        {AXIS.map((l) => (
          <span
            className="mono"
            key={l}
            style={{
              fontSize: 10,
              color: "var(--ink-faint)",
              textAlign: "center",
              paddingTop: 3,
            }}
          >
            {l}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 10.5,
          color: "var(--ink-faint)",
        }}
      >
        <span>↑ severidade</span>
        <span>probabilidade →</span>
      </div>
      <Legend items={HEAT_LEGEND} />
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

export type HeatCell = {
  severity: number;
  likelihood: number;
  count: number;
  codes: string[];
};

/** Mapa de calor clicável. A opacidade cresce com a densidade da célula — dois
 *  casos numa célula e oito noutra não podem parecer o mesmo problema. */
export function Heatmap({
  cells,
  selected,
  onSelect,
}: {
  cells: HeatCell[];
  selected: [number, number] | null;
  onSelect: (cell: [number, number] | null) => void;
}) {
  const at = (s: number, l: number) =>
    cells.find((c) => c.severity === s && c.likelihood === l);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "26px repeat(5, 1fr)",
          gap: 5,
        }}
      >
        {ROWS.map((s) => (
          <Fragment key={s}>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--ink-faint)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              {s}
            </span>
            {AXIS.map((l) => {
              const cell = at(s, l);
              const count = cell?.count ?? 0;
              const tone = toneFor(s * l);
              const on = selected?.[0] === s && selected?.[1] === l;
              return (
                <button
                  aria-label={`Severidade ${s}, probabilidade ${l}: ${count} casos`}
                  aria-pressed={on}
                  className="cell-hit btn"
                  key={l}
                  onClick={() => onSelect(on ? null : [s, l])}
                  style={{
                    aspectRatio: "1.35",
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    background: count
                      ? `rgba(var(--${tone}-rgb),${0.14 + Math.min(count, 4) * 0.14})`
                      : `rgba(var(--${tone}-rgb),.05)`,
                    border: `1px solid ${on ? `var(--${tone})` : `rgba(var(--${tone}-rgb),${count ? 0.3 : 0.12})`}`,
                    outline: on
                      ? `2px solid rgba(var(--${tone}-rgb),.45)`
                      : "none",
                    outlineOffset: 2,
                  }}
                  type="button"
                >
                  {/* Número sempre visível: a célula não pode depender só da cor. */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: count ? `var(--${tone}-text)` : "var(--ink-faint)",
                      opacity: count ? 1 : 0.5,
                    }}
                  >
                    {count || "·"}
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}
        <span />
        {AXIS.map((l) => (
          <span
            className="mono"
            key={l}
            style={{
              fontSize: 10.5,
              color: "var(--ink-faint)",
              textAlign: "center",
              paddingTop: 4,
              fontWeight: 700,
            }}
          >
            {l}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 9,
          fontSize: 11,
          color: "var(--ink-faint)",
          fontWeight: 600,
        }}
      >
        <span>↑ severidade máxima</span>
        <span>probabilidade média →</span>
      </div>
      <Legend items={HEAT_LEGEND} />
    </div>
  );
}

// ── MitigationTable ───────────────────────────────────────────────────────────

const MIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Aberta", tone: "accent" },
  PROGRESS: { label: "Em andamento", tone: "amber" },
  DONE: { label: "Concluída", tone: "green" },
};

const MIT_COLS = "76px minmax(0,1fr) 120px 110px 84px 108px";

export function MitigationTable({
  rows,
  onOpen,
}: {
  rows: MitigationRow[];
  onOpen?: (useCaseCode: string) => void;
}) {
  return (
    <>
      <TableHead
        cols={MIT_COLS}
        labels={[
          "Caso",
          "Ação de mitigação",
          "Categoria",
          "Dono",
          "Prazo",
          "Status",
        ]}
      />
      {rows.map((m, i) => {
        // Atrasada é derivado, não persistido — por isso vence o status na UI.
        const st = m.overdue
          ? { label: "Atrasada", tone: "red" as Tone }
          : (MIT_STATUS[m.status] ?? MIT_STATUS.OPEN);
        return (
          <TableRow
            cols={MIT_COLS}
            key={m.id}
            label={onOpen ? `Abrir ${m.useCaseCode}` : undefined}
            last={i === rows.length - 1}
            onClick={onOpen ? () => onOpen(m.useCaseCode) : undefined}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent-text)",
              }}
            >
              {m.useCaseCode}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.action}
              </div>
              <span
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-faint)" }}
              >
                {m.code}
              </span>
            </div>
            <Badge
              tone={
                RISK_CATEGORY_TONE[
                  m.category as keyof typeof RISK_CATEGORY_TONE
                ]
              }
            >
              {
                RISK_CATEGORY_LABEL[
                  m.category as keyof typeof RISK_CATEGORY_LABEL
                ]
              }
            </Badge>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              {m.ownerName?.split(" ")[0] ?? "—"}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 12,
                color: m.overdue ? "var(--red-text)" : "var(--ink-muted)",
                fontWeight: m.overdue ? 700 : 500,
              }}
            >
              {m.dueDate
                ? new Date(m.dueDate).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })
                : "—"}
            </span>
            <Badge dot={m.status === "PROGRESS"} tone={st.tone}>
              {st.label}
            </Badge>
          </TableRow>
        );
      })}
    </>
  );
}

// ── AuditList ─────────────────────────────────────────────────────────────────

export const AUDIT_TYPE_META: Record<
  string,
  { label: string; tone: Tone; icon: IconName }
> = {
  policy: { label: "Política", tone: "accent", icon: "fileText" },
  decision: { label: "Decisão", tone: "green", icon: "gavel" },
  risk: { label: "Risco", tone: "amber", icon: "alert" },
  vendor: { label: "Fornecedor", tone: "blue", icon: "plug" },
  onboarding: { label: "Onboarding", tone: "purple", icon: "userCheck" },
  export: { label: "Exportação", tone: "accent", icon: "download" },
  settings: { label: "Configuração", tone: "accent", icon: "settings" },
  compliance: { label: "Conformidade", tone: "accent", icon: "scale" },
};

/** Lista expansível. O diff campo-a-campo fica colapsado por padrão: a trilha
 *  precisa ser escaneável, e o detalhe só interessa na entrada que o auditor
 *  escolheu investigar (FR-11.2). */
export function AuditList({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      {rows.map((a, i) => {
        const t = AUDIT_TYPE_META[a.type] ?? AUDIT_TYPE_META.policy;
        const on = open === a.id;
        return (
          <div
            key={a.id}
            style={{
              borderBottom:
                i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <button
              aria-expanded={on}
              aria-label={`${a.action} ${a.target}`}
              className="navitem btn"
              onClick={() => setOpen(on ? null : a.id)}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "13px 16px",
                cursor: "pointer",
                width: "100%",
                border: "none",
                background: "transparent",
                textAlign: "left",
              }}
              type="button"
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  background: `var(--${t.tone}-soft)`,
                  color: `var(--${t.tone}-text)`,
                  border: `1px solid rgba(var(--${t.tone}-rgb),.24)`,
                }}
              >
                <Icon name={t.icon} size={14} strokeWidth={2.1} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {a.action}
                  </span>
                  <Badge tone={t.tone}>{t.label}</Badge>
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: "var(--ink-muted)",
                    marginTop: 3,
                  }}
                >
                  {a.target}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--ink-faint)",
                    marginTop: 4,
                  }}
                >
                  {a.actor} · {a.role} ·{" "}
                  {new Date(a.when).toLocaleString("pt-BR")}
                </span>
              </span>
              <Icon
                name="chevronDown"
                size={15}
                style={{
                  color: "var(--ink-faint)",
                  flexShrink: 0,
                  marginTop: 4,
                  transform: on ? "rotate(180deg)" : "none",
                  transition: "transform .18s ease",
                }}
              />
            </button>
            {on && (
              <div
                style={{
                  padding: "0 16px 14px 56px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {a.note && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink)",
                      fontStyle: "italic",
                      lineHeight: 1.6,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "var(--surface-3)",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    “{a.note}”
                  </div>
                )}
                {a.diff && a.diff.length > 0 && (
                  <div
                    style={{
                      borderRadius: 8,
                      border: "1px solid var(--hairline)",
                      overflow: "hidden",
                    }}
                  >
                    <TableHead
                      cols="140px 1fr 1fr"
                      labels={["Campo", "Antes", "Depois"]}
                    />
                    {a.diff.map(([field, before, after], j) => (
                      <div
                        key={field}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "140px 1fr 1fr",
                          gap: 12,
                          padding: "9px 14px",
                          borderBottom:
                            j < (a.diff?.length ?? 0) - 1
                              ? "1px solid var(--hairline)"
                              : "none",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "var(--ink-muted)",
                          }}
                        >
                          {field}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 11.5, color: "var(--red-text)" }}
                        >
                          {before}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 11.5, color: "var(--green-text)" }}
                        >
                          {after}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    icon="copy"
                    onClick={() => navigator.clipboard?.writeText(a.id)}
                    size="sm"
                    variant="ghost"
                  >
                    Copiar referência
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
