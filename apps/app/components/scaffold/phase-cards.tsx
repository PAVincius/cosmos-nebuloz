"use client";

// Os cards laterais do detalhe da trilha, condicionados à fase ativa: janela
// de observação (SG-06), política do Charter (S-11 / SG-05) e handover pack
// (S-10 / SN-09). Cada um decide sozinho se aparece — a tela só os empilha.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button, Progress, SectionCard } from "@repo/design-system/cosmos/kit";
import type {
  TrackDetail,
  TrackDetailPhase,
} from "@/app/(scaffold)/actions/tracks";
import {
  OBSERVATION_WINDOW_DAYS,
  observationVerdict,
} from "@/lib/scaffold/observation";

export function ObservationCard({ phase }: { phase: TrackDetailPhase }) {
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
export function CharterPolicyCard({
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
export function HandoverCard({
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
