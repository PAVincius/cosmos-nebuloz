"use client";

// O stepper da trilha — a leitura do produto num relance: nó de fase, gate,
// nó, gate. O losango entre as fases é o gate — desenhá-lo como parte do
// trilho, e não como rótulo dentro do card, é o que faz "a fase não avança sem
// passar por aqui" virar imagem em vez de texto.

import { Icon } from "@repo/design-system/cosmos/icons";
import type {
  TrackDetail,
  TrackDetailPhase,
} from "@/app/(scaffold)/actions/tracks";
import { PHASE, PHASE_ORDER, PHASE_STATE } from "@/lib/scaffold/phases";
import { StatusDot } from "./base";

export const GATE_VIS = {
  passed: { tone: "green", icon: "check", label: "Gate fechado" },
  ready: { tone: "amber", icon: "shield", label: "Gate pronto para decisão" },
  blocked: { tone: "red", icon: "x", label: "Gate bloqueado" },
  locked: { tone: "neutral", icon: "shield", label: "Gate futuro" },
} as const;

export type GateVisual = keyof typeof GATE_VIS;

export function gateVisualFor(phase: TrackDetailPhase): GateVisual {
  if (phase.state === "CLOSED" || phase.state === "OBSERVING") {
    return "passed";
  }
  if (phase.state === "GATE_READY") {
    return "ready";
  }
  if (phase.state === "BLOCKED") {
    return "blocked";
  }
  return "locked";
}

function GateDiamond({ state }: { state: GateVisual }) {
  const v = GATE_VIS[state];
  const locked = state === "locked";
  return (
    <span
      aria-label={v.label}
      className={state === "ready" ? "pulse-dot" : ""}
      role="img"
      style={
        {
          "--pulse-rgb": `var(--${v.tone}-rgb)`,
          width: 26,
          height: 26,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          transform: "rotate(45deg)",
          borderRadius: 7,
          background: locked ? "var(--surface-2)" : `var(--${v.tone}-soft)`,
          border: `1.5px ${locked ? "dashed var(--hairline-strong)" : `solid rgba(var(--${v.tone}-rgb),.55)`}`,
          boxShadow: locked
            ? "none"
            : `0 0 12px rgba(var(--${v.tone}-rgb),.35)`,
        } as React.CSSProperties
      }
      title={v.label}
    >
      <Icon
        name={v.icon}
        size={12}
        strokeWidth={2.6}
        style={{
          transform: "rotate(-45deg)",
          color: locked ? "var(--ink-faint)" : `var(--${v.tone}-text)`,
        }}
      />
    </span>
  );
}

function RailSegment({ done }: { done: boolean }) {
  return (
    <span
      style={{
        flex: 1,
        height: 2,
        borderRadius: 99,
        background: done
          ? "linear-gradient(90deg, rgba(var(--green-rgb),.7), rgba(var(--green-rgb),.35))"
          : "none",
        borderTop: done ? "none" : "2px dashed var(--hairline-strong)",
        boxShadow: done ? "0 0 8px rgba(var(--green-rgb),.25)" : "none",
      }}
    />
  );
}

export function PhaseStepper({
  track,
  activePhase,
  onSelect,
}: {
  track: TrackDetail;
  activePhase: string;
  onSelect: (p: string) => void;
}) {
  const idx = PHASE_ORDER.indexOf(track.currentPhase);
  const embedded = track.status === "EMBEDDED";
  return (
    <div
      style={{
        padding: "18px 18px 16px",
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 6px",
          marginBottom: 14,
        }}
      >
        {track.phases.map((p, i) => {
          const done = i < idx || embedded;
          const cur = i === idx && !embedded;
          const tone = done
            ? "green"
            : cur
              ? PHASE_STATE[p.state].tone
              : "neutral";
          return (
            <div
              key={p.id}
              style={{
                display: "contents",
              }}
            >
              <span
                aria-label={`Fase ${PHASE[p.phase].n} — ${PHASE[p.phase].label}`}
                role="img"
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 99,
                  background:
                    done || cur ? `var(--${tone}-soft)` : "var(--surface-2)",
                  border: `1.5px solid ${done || cur ? `rgba(var(--${tone}-rgb),.55)` : "var(--hairline-strong)"}`,
                  boxShadow: cur
                    ? `0 0 0 4px rgba(var(--${tone}-rgb),.12), 0 0 16px rgba(var(--${tone}-rgb),.4)`
                    : "none",
                }}
              >
                {done ? (
                  <Icon
                    name="check"
                    size={14}
                    strokeWidth={2.8}
                    style={{ color: "var(--green-text)" }}
                  />
                ) : (
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: cur ? `var(--${tone}-text)` : "var(--ink-faint)",
                    }}
                  >
                    {PHASE[p.phase].n}
                  </span>
                )}
              </span>
              {i < track.phases.length - 1 && (
                <>
                  <RailSegment done={done} />
                  <GateDiamond state={gateVisualFor(p)} />
                  <RailSegment done={done} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        {track.phases.map((p) => {
          const st = PHASE_STATE[p.state];
          const on = activePhase === p.phase;
          return (
            <button
              aria-pressed={on}
              className="btn lift"
              key={p.id}
              onClick={() => onSelect(p.phase)}
              style={{
                textAlign: "left",
                padding: "12px 13px",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                background: on ? "var(--surface-2)" : "transparent",
                border: `1px solid ${on ? `rgba(var(--${st.tone}-rgb),.45)` : "var(--hairline)"}`,
                boxShadow: on
                  ? `0 8px 26px -14px rgba(var(--${st.tone}-rgb),.5)`
                  : "none",
              }}
              type="button"
            >
              {on && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: `var(--${st.tone})`,
                    boxShadow: `0 0 10px 1px rgba(var(--${st.tone}-rgb),.6)`,
                  }}
                />
              )}
              <div
                className="display"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                {PHASE[p.phase].label}
              </div>
              <div style={{ marginBottom: 6 }}>
                <StatusDot label={st.label} tone={st.tone} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  lineHeight: 1.45,
                }}
              >
                {PHASE[p.phase].desc}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px dashed var(--hairline)",
                }}
              >
                <Icon
                  name="shield"
                  size={11}
                  strokeWidth={2.2}
                  style={{
                    color: "var(--ink-faint)",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-subtle)",
                    lineHeight: 1.45,
                  }}
                >
                  {PHASE[p.phase].gate}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
