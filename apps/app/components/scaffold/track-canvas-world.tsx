"use client";

// O desenho do canvas: colunas de fase, blocos de passo, nós de entregável,
// gates em losango e as arestas. Só leitura — cada peça é um botão que seleciona;
// nada aqui grava. A matemática (onde cada coisa cai) é de `canvas-layout.ts`.

import { Icon } from "@repo/design-system/cosmos/icons";
import type { TrackDetail } from "@/app/(scaffold)/actions/tracks";
import { CANVAS, type CanvasLayout } from "@/lib/scaffold/canvas-layout";
import { STATUS } from "@/lib/scaffold/deliverable-labels";
import { PHASE, PHASE_STATE } from "@/lib/scaffold/phases";
import type { DeliverableItem } from "./deliverable-list";
import { GATE_VIS } from "./phase-stepper";
import {
  type CanvasSel,
  gateSummary,
  isSame,
  stepStatement,
} from "./track-canvas-model";

type Layout = CanvasLayout<DeliverableItem>;

export type OnSelect = (sel: CanvasSel, el: HTMLElement) => void;

// Um botão do desenho não inicia o arrasto da vista: o ponteiro é do botão.
const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const approvedOf = (items: DeliverableItem[]) =>
  items.filter((d) => d.status === "APPROVED").length;

export function CanvasWorld({
  layout,
  track,
  deliverables,
  sel,
  onSelect,
}: {
  layout: Layout;
  track: TrackDetail;
  deliverables: DeliverableItem[];
  sel: CanvasSel | null;
  onSelect: OnSelect;
}) {
  const phaseOf = (p: string) => track.phases.find((x) => x.phase === p);
  const future = (p: string) => phaseOf(p)?.state === "IDLE";

  return (
    <>
      <svg
        aria-hidden="true"
        height={layout.h}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        width={layout.w}
      >
        <defs>
          <marker
            id="sc-cv-arrow"
            markerHeight="7"
            markerWidth="7"
            orient="auto-start-reverse"
            refX="8"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-faint)" />
          </marker>
        </defs>
        {layout.edges.map((e) => (
          <path
            d={e.d}
            fill="none"
            key={e.id}
            markerEnd="url(#sc-cv-arrow)"
            opacity={0.8}
            stroke={
              future(e.phase) ? "var(--hairline-strong)" : "var(--ink-faint)"
            }
            strokeDasharray={future(e.phase) ? "4 5" : undefined}
            strokeWidth={e.gate ? 1.6 : 1.3}
          />
        ))}
      </svg>

      {layout.columns.map((c) => {
        const ph = phaseOf(c.phase);
        if (!ph) {
          return null;
        }
        const own = deliverables.filter((d) => d.phaseInstanceId === ph.id);
        const ap = approvedOf(own);
        const st = PHASE_STATE[ph.state];
        const current = track.currentPhase === c.phase;
        const on = isSame(sel, "phase", c.phase);
        return (
          <div key={c.phase}>
            <button
              className="sc-cv-hit btn"
              onClick={(e) =>
                onSelect({ type: "phase", id: c.phase }, e.currentTarget)
              }
              onPointerDown={stop}
              style={{
                position: "absolute",
                left: c.x,
                top: 0,
                width: CANVAS.COL_W,
                height: CANVAS.HEAD_H,
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: "var(--r-lg)",
                cursor: "pointer",
                color: "var(--ink)",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: current ? "var(--accent-soft)" : "var(--surface)",
                border: `1px solid ${current ? "rgba(var(--accent-rgb),.35)" : "var(--hairline-strong)"}`,
                boxShadow: on
                  ? "0 0 0 3px rgba(var(--accent-rgb),.28)"
                  : "var(--card-shadow)",
              }}
              type="button"
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--ink-faint)",
                  }}
                >
                  0{PHASE[c.phase].n}
                </span>
                <span
                  className="display"
                  style={{ fontSize: 15, fontWeight: 700 }}
                >
                  {PHASE[c.phase].label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: `var(--${st.tone}-text)`,
                  }}
                >
                  {st.label}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 99,
                    background: "var(--surface-3)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${own.length ? (ap / own.length) * 100 : 0}%`,
                      background: `var(--${own.length && ap === own.length ? "green" : "accent"})`,
                    }}
                  />
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "var(--ink-muted)" }}
                >
                  {own.length ? `${ap}/${own.length}` : "sem entregáveis"}
                </span>
              </span>
            </button>

            {c.steps.map((b) => {
              const items = own.filter((d) => d.stepCode === b.stepCode);
              const done =
                items.length > 0 && approvedOf(items) === items.length;
              const name = stepStatement(ph, b.stepCode);
              return (
                <div
                  key={b.id}
                  style={{
                    position: "absolute",
                    left: b.x,
                    top: b.y,
                    width: b.w,
                    height: b.h,
                    borderRadius: "var(--r-lg)",
                    border: `1px ${future(c.phase) ? "dashed" : "solid"} var(--hairline-strong)`,
                    background: "var(--surface-2)",
                    boxShadow: isSame(sel, "step", b.id)
                      ? "0 0 0 3px rgba(var(--accent-rgb),.28)"
                      : "none",
                  }}
                >
                  <button
                    className="sc-cv-hit"
                    onClick={(e) =>
                      onSelect({ type: "step", id: b.id }, e.currentTarget)
                    }
                    onPointerDown={stop}
                    style={{
                      all: "unset",
                      boxSizing: "border-box",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      height: CANVAS.STEP_HEAD,
                      padding: "0 12px",
                      borderRadius: "var(--r-lg) var(--r-lg) 0 0",
                    }}
                    type="button"
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: done ? "var(--green-text)" : "var(--ink-faint)",
                      }}
                    >
                      {b.stepCode}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "var(--ink-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flex: 1,
                      }}
                    >
                      {name ?? "Passo do método"}
                    </span>
                    {done ? (
                      <span
                        style={{ color: "var(--green-text)", display: "flex" }}
                      >
                        <Icon name="check" size={13} strokeWidth={2.4} />
                        <span style={SR_ONLY}>, todos aprovados</span>
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {layout.nodes.map((n) => (
        <DeliverableNode
          key={n.id}
          node={n}
          on={isSame(sel, "dv", n.id)}
          onSelect={onSelect}
        />
      ))}

      {layout.gates.map((g) => {
        const ph = phaseOf(g.phase);
        if (!ph) {
          return null;
        }
        const s = gateSummary(ph);
        const on = isSame(sel, "gate", g.id);
        const locked = s.visual === "locked";
        return (
          <button
            aria-label={`Gate ${PHASE[g.phase].label}, ${s.word}`}
            className="sc-cv-hit"
            key={g.id}
            onClick={(e) =>
              onSelect({ type: "gate", id: g.id }, e.currentTarget)
            }
            onPointerDown={stop}
            style={{
              position: "absolute",
              left: g.x - 22,
              top: g.y - 22,
              width: 44,
              height: 44,
              padding: 0,
              border: 0,
              background: "none",
              cursor: "pointer",
              borderRadius: 12,
            }}
            type="button"
          >
            <span
              className={s.visual === "ready" ? "pulse-dot" : ""}
              style={
                {
                  "--pulse-rgb": `var(--${s.tone}-rgb)`,
                  position: "absolute",
                  inset: 8,
                  transform: "rotate(45deg)",
                  borderRadius: 7,
                  background: locked
                    ? "var(--surface-2)"
                    : `var(--${s.tone}-soft)`,
                  border: locked
                    ? "1.5px dashed var(--hairline-strong)"
                    : `1.5px solid rgba(var(--${s.tone}-rgb),.55)`,
                  boxShadow: on
                    ? "0 0 0 4px rgba(var(--accent-rgb),.28)"
                    : "none",
                } as React.CSSProperties
              }
            />
            <span
              style={{
                position: "relative",
                display: "grid",
                placeItems: "center",
                height: "100%",
                color: locked ? "var(--ink-faint)" : `var(--${s.tone}-text)`,
              }}
            >
              <Icon
                name={GATE_VIS[s.visual].icon}
                size={14}
                strokeWidth={2.2}
              />
            </span>
            <span
              style={{
                position: "absolute",
                top: 46,
                left: "50%",
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                }}
              >
                GATE {PHASE[g.phase].label.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: locked ? "var(--ink-muted)" : `var(--${s.tone}-text)`,
                }}
              >
                {s.word}
              </span>
            </span>
          </button>
        );
      })}
    </>
  );
}

function DeliverableNode({
  node,
  on,
  onSelect,
}: {
  node: Layout["nodes"][number];
  on: boolean;
  onSelect: OnSelect;
}) {
  const d = node.deliverable;
  const dispensed = d.dispensedReason !== null;
  const S = STATUS[d.status];
  const tone = dispensed ? "neutral" : S.tone;
  const word = dispensed ? "Dispensado" : S.label;
  return (
    <button
      aria-label={`${d.code} ${d.title}, ${word}`}
      aria-pressed={on}
      className="sc-cv-hit"
      onClick={(e) => onSelect({ type: "dv", id: node.id }, e.currentTarget)}
      onPointerDown={stop}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 10px 0 8px",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "var(--ink)",
        background: "var(--surface)",
        borderRadius: "var(--r-md)",
        border: `1px ${dispensed ? "dashed" : "solid"} ${
          dispensed || d.status === "NOT_STARTED"
            ? "var(--hairline-strong)"
            : `rgba(var(--${tone}-rgb),.45)`
        }`,
        boxShadow: on
          ? "0 0 0 3px rgba(var(--accent-rgb),.28)"
          : "var(--card-shadow)",
      }}
      type="button"
    >
      <span
        style={{
          width: 3,
          alignSelf: "stretch",
          margin: "8px 0",
          borderRadius: 99,
          background: `var(--${tone})`,
          opacity: d.status === "NOT_STARTED" || dispensed ? 0.45 : 1,
        }}
      />
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: `var(--${tone}-soft)`,
          color: `var(--${tone}-text)`,
        }}
      >
        <Icon
          name={d.status === "APPROVED" && !dispensed ? "check" : "fileText"}
          size={13}
          strokeWidth={2}
        />
      </span>
      <span
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {d.title}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: `var(--${tone}-text)`,
            }}
          >
            {word}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--ink-faint)",
              marginLeft: "auto",
            }}
          >
            {d.code}
            {d.version > 0 ? ` · v${d.version}` : ""}
          </span>
        </span>
      </span>
    </button>
  );
}
