"use client";

// Detalhe da trilha — S-04, S-02/S-03, SG-05, SG-06.
// Port de `scaffold-screens-2.jsx`.
//
// O stepper é a leitura do produto num relance: nó de fase, gate, nó, gate. O
// losango entre as fases é o gate — desenhá-lo como parte do trilho, e não como
// rótulo dentro do card, é o que faz "a fase não avança sem passar por aqui"
// virar imagem em vez de texto.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  PageHeader,
  Progress,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportHandoverPack } from "@/app/(scaffold)/actions/export";
import {
  acknowledgeCharterPolicy,
  closePhase,
  overridePhase,
  reopenPhase,
} from "@/app/(scaffold)/actions/gates";
import {
  attachArtefact,
  readArtefact,
  setStepState,
} from "@/app/(scaffold)/actions/steps";
import {
  cancelTrack,
  getTrack,
  type TrackDetail,
  type TrackDetailPhase,
} from "@/app/(scaffold)/actions/tracks";
import {
  OBSERVATION_WINDOW_DAYS,
  observationVerdict,
} from "@/lib/scaffold/observation";
import { PHASE, PHASE_ORDER, PHASE_STATE } from "@/lib/scaffold/phases";
import {
  Eyebrow,
  Field,
  MetaCell,
  ModalShell,
  ScreenError,
  Select,
  SkeletonCard,
  SmartEmptyState,
  StatusDot,
  Textarea,
} from "../base";
import { type CriterionFacts, type GateNotice, GatePanel } from "../gate-panel";

const GATE_VIS = {
  passed: { tone: "green", icon: "check", label: "Gate fechado" },
  ready: { tone: "amber", icon: "shield", label: "Gate pronto para decisão" },
  blocked: { tone: "red", icon: "x", label: "Gate bloqueado" },
  locked: { tone: "neutral", icon: "shield", label: "Gate futuro" },
} as const;

type GateVisual = keyof typeof GATE_VIS;

/** Os três atos que rescrevem o histórico de uma trilha, e por isso pedem
 *  justificativa. O texto mora aqui, e não em ternários no JSX, para que os
 *  três se leiam lado a lado. */
const MODAL_COPY = {
  override: {
    icon: "shield",
    tone: "amber",
    title: "Override do gate",
    subtitle:
      "SG-03 · fica no histórico do gate, com nome e justificativa, para sempre",
    cta: "Registrar override e fechar",
    placeholder:
      "Por que o critério pode ser dispensado nesta trilha, e o que cobre o risco que ele media.",
  },
  reopen: {
    icon: "refresh",
    tone: "red",
    title: "Reabrir",
    subtitle:
      "SG-06 · reabrir zera a janela de observação e invalida a entrega",
    cta: "Reabrir fase",
    placeholder:
      "O que voltou a não valer, e o que precisa ser refeito antes de fechar de novo.",
  },
  cancel: {
    icon: "x",
    tone: "red",
    title: "Cancelar trilha",
    subtitle:
      "A trilha sai do portfólio. O que já foi registrado — gates, overrides, artefatos — fica.",
    cta: "Cancelar trilha",
    placeholder:
      "Por que este processo não segue. Quem lê a auditoria daqui a um ano precisa entender sem perguntar.",
  },
} as const;

function gateVisualFor(phase: TrackDetailPhase): GateVisual {
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

function PhaseStepper({
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

function StepList({
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

function ObservationCard({ phase }: { phase: TrackDetailPhase }) {
  if (phase.state !== "OBSERVING" || !phase.observationEndsAt) {
    return null;
  }
  // A mesma função que a varredura noturna usa: dois cálculos da mesma janela
  // divergiriam, e a tela diria 29 enquanto o job entrega no 30.
  const { elapsedDays: elapsed } = observationVerdict({
    observationEndsAt: phase.observationEndsAt,
    reopenCount: phase.reopenCount,
    reopenCountAtClose: phase.reopenCountAtClose,
  });
  return (
    <SectionCard
      icon="clock"
      subtitle="SG-06 · 30 dias sem a Nebuloz antes de marcar como embedded"
      title="Janela de observação"
      tone="blue"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          className="mono"
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "var(--blue-text)",
            letterSpacing: "-.02em",
          }}
        >
          {elapsed}
          <span style={{ fontSize: 14, color: "var(--ink-faint)" }}>
            /{OBSERVATION_WINDOW_DAYS}
          </span>
        </span>
        <div style={{ flex: 1 }}>
          <Progress
            height={8}
            tone="blue"
            value={(elapsed / OBSERVATION_WINDOW_DAYS) * 100}
          />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 9 }}>
        {phase.reopenCount > 0
          ? `Reaberta ${phase.reopenCount}× — cada reabertura zera a janela.`
          : "Nenhuma reabertura até agora — reabrir zera a janela."}
      </div>
    </SectionCard>
  );
}

/** S-11 / SG-05 — a política do Charter dentro dos passos da Fase 3.
 *
 *  Some inteira quando o Charter não está contratado. É a degradação graciosa
 *  do SRD §8: mostrar um card vazio prometeria integração que o tenant não
 *  comprou, e SG-05 também não bloqueia nesse caso. */
function CharterPolicyCard({
  phase,
  busy,
  onAck,
}: {
  phase: TrackDetailPhase;
  busy: boolean;
  onAck: (policyId: string) => void;
}) {
  if (phase.phase !== "SCALE") {
    return null;
  }
  if (phase.charterAvailable.length === 0 && !phase.charterPolicy) {
    return null;
  }

  const acked = Boolean(phase.charterPolicyAckAt);
  return (
    <SectionCard
      icon="shield"
      subtitle="S-11 · pré-condição do gate do Scale (SG-05)"
      title="Política do Charter"
      tone={acked ? "green" : "purple"}
    >
      {phase.charterPolicy ? (
        <>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 5,
            }}
          >
            {phase.charterPolicy.name}
            {phase.charterPolicy.version ? (
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  marginLeft: 7,
                }}
              >
                v{phase.charterPolicy.version}
              </span>
            ) : null}
          </div>
          {phase.charterPolicy.scope ? (
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--ink-muted)",
              }}
            >
              {phase.charterPolicy.scope}
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginTop: 11,
              paddingTop: 10,
              borderTop: "1px solid var(--hairline)",
            }}
          >
            <Icon
              name={acked ? "check" : "clock"}
              size={13}
              style={{
                color: acked ? "var(--green-text)" : "var(--amber-text)",
              }}
            />
            <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
              {acked
                ? `Aceita em ${phase.charterPolicyAckAt?.toLocaleDateString("pt-BR")} — o gate do Scale pode fechar`
                : "Aguardando aceite — sem ele, SG-05 bloqueia o gate"}
            </span>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Nenhuma política vinculada. O gate do Scale não fecha até que uma
            política publicada seja aceita para este fluxo.
          </p>
          {phase.charterAvailable.map((p) => (
            <Button
              disabled={busy}
              icon="shield"
              key={p.id}
              onClick={() => onAck(p.id)}
              size="sm"
              variant="secondary"
            >
              Aplicar “{p.name}”
            </Button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** S-10 / SN-09 — o pacote que encerra a trilha.
 *
 *  Só aparece com o gate da Fase 4 fechado: gerá-lo antes entregaria ao cliente
 *  um "handover" de trabalho que ainda é nosso. */
function HandoverCard({
  track,
  phase,
  busy,
  onExport,
}: {
  track: TrackDetail;
  phase: TrackDetailPhase;
  busy: boolean;
  onExport: () => void;
}) {
  if (phase.phase !== "EMBED" || !phase.closedAt) {
    return null;
  }
  return (
    <SectionCard
      icon="download"
      subtitle="S-10 · SN-09 · abre sem conta Nebuloz e sem conexão"
      title="Handover pack"
      tone="green"
    >
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--ink-muted)",
        }}
      >
        Runbook, donos, histórico de gates com os overrides que houve, o caso de
        negócio assinado e os artefatos de cada fase — tudo embutido num arquivo
        só. É o que {track.ownerName ?? "o time"} leva quando a Nebuloz sai.
      </p>
      <Button
        disabled={busy}
        icon="download"
        onClick={onExport}
        variant="secondary"
      >
        Exportar handover pack
      </Button>
    </SectionCard>
  );
}

export default function TrackDetailScreen({ param }: { param?: string }) {
  const router = useRouter();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gateNotice, setGateNotice] = useState<GateNotice | null>(null);
  // Um modal por vez: override pede a lista do que foi dispensado; reabrir
  // pede só a justificativa. Os dois escrevem no histórico do gate.
  const [modal, setModal] = useState<
    | { kind: "override"; unmet: string[] }
    | { kind: "reopen" }
    | { kind: "cancel" }
    | null
  >(null);
  const [rationale, setRationale] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  // Cancelar trilha com caso assinado obriga a dizer o que o Signal faz com a
  // apuração — sem decisão, o servidor recusa (TRACK_HAS_SIGNED_BUSINESS_CASE).
  const [signalDecision, setSignalDecision] = useState<
    "keep_reading" | "stop_reading"
  >("stop_reading");
  // A fase ativa muda com o clique no stepper; o callback de aceite é criado
  // antes dela ser resolvida, então o id viaja por ref.
  const activePhaseId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!param) {
      return;
    }
    setError(null);
    const res = await getTrack({ trackId: param });
    if (res.ok) {
      setTrack(res.data);
      setPhase((p) => p ?? res.data.currentPhase);
    } else {
      setError(res.error);
    }
  }, [param]);

  useEffect(() => {
    load();
  }, [load]);

  const ackPolicy = useCallback(
    async (policyId: string) => {
      if (!activePhaseId.current) {
        return;
      }
      const res = await acknowledgeCharterPolicy({
        phaseInstanceId: activePhaseId.current,
        policyId,
      });
      if (res.ok) {
        await load();
      } else {
        setError(res.error);
      }
    },
    [load]
  );

  const exportHandover = useCallback(async () => {
    if (!param) {
      return;
    }
    setBusy(true);
    const res = await exportHandoverPack({ trackId: param });
    setBusy(false);
    if (res.ok) {
      // Abre em aba nova: a URL é assinada e de curta duração, e navegar a
      // página atual para um download deixaria o usuário sem para onde voltar.
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  }, [param]);

  const toggleStep = useCallback(
    async (stepId: string, next: "DONE" | "TODO") => {
      const res = await setStepState({ stepInstanceId: stepId, state: next });
      if (res.ok) {
        await load();
      } else {
        setError(res.error);
      }
    },
    [load]
  );

  // Recusa de regra (tem `code`) fica no painel do gate; falha de servidor
  // derruba a tela como qualquer outra.
  const gateRefused = useCallback(
    (res: { error: string; code?: string; blockers?: string[] }) => {
      if (res.code) {
        setGateNotice({ message: res.error, blockers: res.blockers ?? [] });
        return true;
      }
      setError(res.error);
      return false;
    },
    []
  );

  const closeGate = useCallback(
    async (facts: CriterionFacts) => {
      if (!(activePhaseId.current && track)) {
        return;
      }
      setBusy(true);
      const res = await closePhase({
        phaseInstanceId: activePhaseId.current,
        // Quem assina o gate é o dono do processo — é a posse nomeada que o
        // override precisa para valer alguma coisa. Um seletor de aprovador
        // entra quando houver caso real de outra pessoa assinar.
        approverId: track.ownerId,
        criteriaFacts: facts,
      });
      setBusy(false);
      if (res.ok) {
        setGateNotice(null);
      } else {
        gateRefused(res);
      }
      // Recarrega nos dois casos: SG-02 move a fase para BLOCKED mesmo
      // recusando, e o painel precisa refletir isso para oferecer o override.
      await load();
    },
    [load, track, gateRefused]
  );

  const openModal = useCallback((m: NonNullable<typeof modal>) => {
    setRationale("");
    setModalError(null);
    setModal(m);
  }, []);

  const submitModal = useCallback(async () => {
    if (!(activePhaseId.current && modal && param)) {
      return;
    }
    setBusy(true);
    let res: { ok: boolean; error?: string };
    if (modal.kind === "override") {
      res = await overridePhase({
        phaseInstanceId: activePhaseId.current,
        unmetCriteria: modal.unmet,
        rationale,
      });
    } else if (modal.kind === "reopen") {
      res = await reopenPhase({
        phaseInstanceId: activePhaseId.current,
        rationale,
      });
    } else {
      res = await cancelTrack({
        trackId: param,
        rationale,
        signalDecision: track?.businessCase?.signed
          ? signalDecision
          : undefined,
      });
    }
    setBusy(false);
    if (res.ok) {
      setModal(null);
      setGateNotice(null);
      if (modal.kind === "cancel") {
        router.push("/scaffold/portfolio");
        return;
      }
      await load();
      return;
    }
    // Recusa fica no modal: a pessoa está no meio de escrever a justificativa
    // e fechar o modal por cima dela jogaria o texto fora.
    setModalError(res.error ?? "Erro inesperado");
  }, [load, modal, rationale, param, track, signalDecision, router]);

  const attach = useCallback(
    async (stepId: string, file: File) => {
      setBusy(true);
      const res = await attachArtefact({
        stepInstanceId: stepId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
      // A URL é assinada para PUT direto no storage: o byte não passa pelo
      // servidor da aplicação.
      const put = await fetch(res.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      setBusy(false);
      if (!put.ok) {
        setError(
          `Upload falhou (${put.status}). O registro do artefato existe; tente anexar de novo.`
        );
        return;
      }
      await load();
    },
    [load]
  );

  const open = useCallback(async (artefactId: string) => {
    const res = await readArtefact({ artefactId });
    if (res.ok) {
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  }, []);

  const selectPhase = useCallback((p: string) => {
    setGateNotice(null);
    setPhase(p);
  }, []);

  if (!param) {
    return (
      <SmartEmptyState
        icon="search"
        onPrimary={() => router.push("/scaffold/portfolio")}
        primaryIcon="arrowLeft"
        primaryLabel="Voltar ao portfólio"
        subtitle="Abra uma trilha a partir do portfólio."
        title="Nenhuma trilha selecionada"
        tone="accent"
      />
    );
  }
  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }
  if (!track) {
    return <SkeletonCard />;
  }

  const activePhase =
    track.phases.find((p) => p.phase === phase) ?? track.phases[0];
  if (!activePhase) {
    return <SkeletonCard />;
  }
  activePhaseId.current = activePhase.id;
  const editable =
    activePhase.state === "OPEN" ||
    activePhase.state === "GATE_READY" ||
    activePhase.state === "BLOCKED";

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow={track.templateName}
        meta={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <StatusDot
              label={PHASE_STATE[activePhase.state].label}
              tone={PHASE_STATE[activePhase.state].tone}
            />
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-faint)" }}
            >
              {track.code} · {track.templateLabel} · início{" "}
              {track.startedAt.toLocaleDateString("pt-BR")}
            </span>
          </div>
        }
        subtitle={
          track.sourceGap
            ? `Semeada da lacuna ${track.sourceGap.code} do Meridian: “${track.sourceGap.statement}”`
            : "Trilha criada sem lacuna de origem."
        }
        title={track.processName}
      >
        <Button
          icon="arrowLeft"
          onClick={() => router.push("/scaffold/portfolio")}
          variant="secondary"
        >
          Portfólio
        </Button>
        {track.status === "ACTIVE" || track.status === "STALLED" ? (
          <Button
            disabled={busy}
            icon="x"
            onClick={() => openModal({ kind: "cancel" })}
            variant="secondary"
          >
            Cancelar trilha
          </Button>
        ) : null}
      </PageHeader>

      <PhaseStepper
        activePhase={activePhase.phase}
        onSelect={selectPhase}
        track={track}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            icon="check"
            subtitle="S-04 · cada passo produz um artefato esperado"
            title={`Passos — ${PHASE[activePhase.phase].label}`}
            tone="accent"
          >
            <StepList
              editable={editable}
              onAttach={attach}
              onOpen={open}
              onToggle={toggleStep}
              phase={activePhase}
            />
          </SectionCard>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <GatePanel
            busy={busy}
            // Trocar de fase zera o que foi marcado: os critérios são outros.
            key={activePhase.id}
            notice={gateNotice}
            onClose={closeGate}
            onOverride={(unmet) => openModal({ kind: "override", unmet })}
            onReopen={() => openModal({ kind: "reopen" })}
            phase={activePhase}
          />
          <CharterPolicyCard
            busy={busy}
            onAck={ackPolicy}
            phase={activePhase}
          />
          <HandoverCard
            busy={busy}
            onExport={exportHandover}
            phase={activePhase}
            track={track}
          />
          <ObservationCard phase={activePhase} />
          <SectionCard
            icon="users"
            subtitle="posse nomeada em cada papel"
            title="Quem responde"
            tone="neutral"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <MetaCell
                label="Dono do processo"
                value={track.ownerName ?? "—"}
              />
              <MetaCell
                label="Consultor Nebuloz"
                value={track.consultantName ?? "não atribuído"}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {modal ? (
        <ModalShell
          actions={
            <>
              <Button
                disabled={busy}
                onClick={() => setModal(null)}
                variant="secondary"
              >
                Voltar
              </Button>
              <Button
                disabled={busy || rationale.trim().length < 20}
                icon={MODAL_COPY[modal.kind].icon}
                onClick={submitModal}
              >
                {MODAL_COPY[modal.kind].cta}
              </Button>
            </>
          }
          icon={MODAL_COPY[modal.kind].icon}
          onClose={() => setModal(null)}
          subtitle={MODAL_COPY[modal.kind].subtitle}
          title={`${MODAL_COPY[modal.kind].title} — ${
            modal.kind === "cancel"
              ? track.code
              : PHASE[activePhase.phase].label
          }`}
          tone={MODAL_COPY[modal.kind].tone}
          width={560}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {modal.kind === "cancel" && track.businessCase?.signed ? (
              <Field
                hint="Há caso de negócio assinado. O Signal precisa saber se continua apurando contra ele."
                htmlFor="cancel-signal"
                label="Apuração do Signal"
                required
              >
                <Select
                  id="cancel-signal"
                  onChange={setSignalDecision}
                  options={[
                    {
                      value: "stop_reading",
                      label: "Parar de apurar — a promessa morre com a trilha",
                    },
                    {
                      value: "keep_reading",
                      label: "Seguir apurando — a promessa sobrevive à trilha",
                    },
                  ]}
                  value={signalDecision}
                />
              </Field>
            ) : null}
            {modal.kind === "override" ? (
              <div>
                <Eyebrow style={{ marginBottom: 6 }}>
                  Critérios que serão dispensados
                </Eyebrow>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: "var(--ink)",
                  }}
                >
                  {modal.unmet.map((k) => (
                    <li key={k}>
                      {activePhase.criteria.find((c) => c.key === k)
                        ?.statement ?? k}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Field
              error={modalError ?? undefined}
              hint="Mínimo de 20 caracteres. “ok” e “urgente” não são justificativa — são gate desligado."
              htmlFor="gate-rationale"
              label="Justificativa"
              required
            >
              <Textarea
                autoFocus
                disabled={busy}
                id="gate-rationale"
                invalid={Boolean(modalError)}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={MODAL_COPY[modal.kind].placeholder}
                value={rationale}
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
