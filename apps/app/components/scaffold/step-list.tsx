"use client";

// Os passos de uma fase — S-04. Cada passo produz um artefato esperado; quem
// executa marca, anexa e abre o que já foi entregue.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge } from "@repo/design-system/cosmos/kit";
import type { TrackDetailPhase } from "@/app/(scaffold)/actions/tracks";

const STEP_ICON: Record<string, string> = {
  DONE: "check",
  ACTIVE: "activity",
  TODO: "clock",
};
const STEP_TONE: Record<string, string> = {
  DONE: "green",
  ACTIVE: "accent",
  TODO: "neutral",
};

export function StepList({
  phase,
  editable,
  onToggle,
  onAttach,
  onOpen,
}: {
  phase: TrackDetailPhase;
  editable: boolean;
  onToggle: (stepId: string, next: "DONE" | "TODO") => void;
  onAttach: (stepId: string, file: File) => void;
  onOpen: (artefactId: string) => void;
}) {
  if (phase.steps.length === 0) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          lineHeight: 1.6,
          padding: "4px 0",
        }}
      >
        O template pinado nesta trilha não define passos para esta fase (ST-03).
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {phase.steps.map((s, i) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "11px 4px",
            borderBottom:
              i === phase.steps.length - 1
                ? "none"
                : "1px solid var(--hairline)",
          }}
        >
          <button
            aria-label={`${s.state === "DONE" ? "Desmarcar" : "Concluir"}: ${s.statement}`}
            className="btn"
            disabled={!editable}
            onClick={() => onToggle(s.id, s.state === "DONE" ? "TODO" : "DONE")}
            style={{
              width: 24,
              height: 24,
              borderRadius: 99,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: `var(--${STEP_TONE[s.state]}-soft)`,
              color: `var(--${STEP_TONE[s.state]}-text)`,
              border: `1px solid rgba(var(--${STEP_TONE[s.state]}-rgb),.3)`,
            }}
            type="button"
          >
            <Icon
              name={STEP_ICON[s.state] ?? "clock"}
              size={12}
              strokeWidth={2.4}
            />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: s.state === "TODO" ? "var(--ink-muted)" : "var(--ink)",
              }}
            >
              {s.statement}
              {!s.required && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-faint)",
                    marginLeft: 7,
                    fontWeight: 500,
                  }}
                >
                  opcional
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 3,
              }}
            >
              <Icon
                name="paperclip"
                size={11}
                style={{ color: "var(--ink-faint)" }}
              />
              {s.artefacts.length > 0 ? (
                s.artefacts.map((a) => (
                  // A URL de leitura é assinada e curta, emitida por artefato
                  // com auditoria antes (SN-02) — por isso é botão, não link.
                  <button
                    className="mono"
                    key={a.id}
                    onClick={() => onOpen(a.id)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      fontSize: 11,
                      color: "var(--accent-text)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                    type="button"
                  >
                    {a.filename}
                  </button>
                ))
              ) : (
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--ink-faint)" }}
                >
                  {s.expectedArtefact}
                </span>
              )}
              {editable ? (
                <label
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-muted)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    aria-label={`Anexar artefato: ${s.statement}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        onAttach(s.id, f);
                      }
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                    type="file"
                  />
                  + anexar
                </label>
              ) : null}
              {s.state === "DONE" && <Badge tone="green">entregue</Badge>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
