"use client";

// O gate engine na tela. É onde `closePhase` — a única porta para CLOSED —
// vira um botão.
//
// Quem avalia marca critério por critério e fecha. Se algum não foi atendido,
// o servidor recusa com SG-02, a fase vai a BLOCKED, e só a partir daí o
// override aparece: não há como dispensar critério sem antes ter tentado
// fechar com ele. Reabrir só existe para fase fechada, e pede justificativa
// como qualquer decisão que rescreve o histórico.
//
// Quando a fase já decidiu, o painel mostra o SNAPSHOT congelado — não os
// critérios de hoje. Mostrar o template atual sobre uma decisão passada
// reescreveria a história do gate na tela, mesmo com o banco correto (SG-07).

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type { TrackDetailPhase } from "@/app/(scaffold)/actions/tracks";
import { PHASE } from "@/lib/scaffold/phases";
import { Eyebrow, GatedButton, Input } from "./base";

/** Veredito por critério: atendido ou não, e a nota de evidência de quem avaliou
 *  (o par que `closePhase` já aceita e grava no snapshot do gate). */
export type CriterionFacts = Record<string, { met: boolean; note?: string }>;

/** Recusa do gate vinda do servidor. Fica dentro do painel: derrubar a tela
 *  inteira por "falta um critério" esconderia a trilha que a pessoa precisa
 *  ver para resolver exatamente isso. */
export type GateNotice = { message: string; blockers: string[] };

export function GatePanel({
  phase,
  busy,
  notice,
  closeBlockedReason = null,
  canOverride = false,
  overrideReason = null,
  canReopen = true,
  reopenReason = null,
  onClose,
  onOverride,
  onReopen,
}: {
  phase: TrackDetailPhase;
  busy: boolean;
  notice: GateNotice | null;
  /** Entregável obrigatório pendente (SG-01): o motivo desabilita o botão e
   *  fica escrito ao lado, em vez de a recusa só vir do servidor. */
  closeBlockedReason?: string | null;
  /** Override é de quem tem `gate.override`. Quem não tem vê o botão
   *  DESABILITADO com o motivo escrito (DESIGN.md: o controle que o papel não
   *  permite não some, diz o que falta) e o clique não faz nada (FR-009). Padrão
   *  fechado: quem esquecer de passar não ganha poder. */
  canOverride?: boolean;
  overrideReason?: string | null;
  /** Quem não fecha gate também não reabre fase (mesmo peso): o botão fica
   *  desabilitado com o motivo (FR-010). */
  canReopen?: boolean;
  reopenReason?: string | null;
  onClose: (facts: CriterionFacts) => void;
  onOverride: (unmet: string[]) => void;
  onReopen: () => void;
}) {
  // `result` é o topo de uma pilha append-only (SG-07): depois de reabrir ele
  // continua lá, mas a fase não está mais decidida. Quem manda é o estado.
  const closed = phase.state === "CLOSED" || phase.state === "OBSERVING";
  const decided = closed ? phase.result : null;
  const decidable =
    !closed && (phase.state === "GATE_READY" || phase.state === "BLOCKED");
  const [facts, setFacts] = useState<CriterionFacts>({});

  const snapshot = decided?.criteriaSnapshot as
    | { key: string; statement: string; met: boolean; note: string | null }[]
    | undefined;
  const criteria =
    snapshot ??
    phase.criteria.map((c) => ({
      ...c,
      met: facts[c.key]?.met ?? false,
      note: null as string | null,
    }));
  const met = criteria.filter((c) => c.met).length;
  const statementOf = (key: string) =>
    phase.criteria.find((c) => c.key === key)?.statement ?? key;

  // Marcar e desmarcar não apaga a evidência já escrita, e escrever evidência
  // não marca o critério: são dois campos do mesmo veredito.
  const toggle = (key: string) =>
    setFacts((f) => ({
      ...f,
      [key]: { ...f[key], met: !(f[key]?.met ?? false) },
    }));
  const setNote = (key: string, note: string) =>
    setFacts((f) => ({
      ...f,
      [key]: { met: f[key]?.met ?? false, note },
    }));

  /** O que vai ao servidor: nota vazia não é nota. */
  const factsToSend = (): CriterionFacts =>
    Object.fromEntries(
      Object.entries(facts).map(([key, f]) => {
        const note = f.note?.trim();
        return [key, note ? { met: f.met, note } : { met: f.met }];
      })
    );

  return (
    <SectionCard
      action={
        decided ? (
          <Badge tone={decided.outcome === "OVERRIDDEN" ? "amber" : "green"}>
            {decided.outcome === "OVERRIDDEN"
              ? "fechado por override"
              : "fechado"}
          </Badge>
        ) : null
      }
      icon="shield"
      subtitle={PHASE[phase.phase].gate}
      title="Gate da fase"
      tone={decided ? "green" : phase.state === "BLOCKED" ? "red" : "amber"}
    >
      {criteria.length === 0 ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "6px 0",
          }}
        >
          O template não define critério para esta fase.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {criteria.map((c) => (
            <div
              key={c.key}
              style={{ display: "flex", flexDirection: "column", gap: 5 }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                {decidable ? (
                  <input
                    aria-label={c.statement}
                    checked={c.met}
                    disabled={busy}
                    onChange={() => toggle(c.key)}
                    style={{
                      flexShrink: 0,
                      margin: 0,
                      transform: "translateY(2px)",
                      accentColor: "var(--green)",
                      cursor: busy ? "default" : "pointer",
                    }}
                    type="checkbox"
                  />
                ) : (
                  <Icon
                    name={c.met ? "check" : "x"}
                    size={13}
                    strokeWidth={2.6}
                    style={{
                      color: c.met ? "var(--green-text)" : "var(--red-text)",
                      flexShrink: 0,
                      transform: "translateY(2px)",
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                    flex: 1,
                  }}
                >
                  {c.statement}
                </span>
              </div>
              {decidable ? (
                <div style={{ paddingLeft: 23 }}>
                  <Input
                    aria-label={`Evidência: ${c.statement}`}
                    autoComplete="off"
                    disabled={busy}
                    maxLength={500}
                    onChange={(e) => setNote(c.key, e.target.value)}
                    placeholder="Evidência: onde se vê que foi atendido (opcional)"
                    style={{ fontSize: 12, padding: "6px 9px" }}
                    value={facts[c.key]?.note ?? ""}
                  />
                </div>
              ) : c.note ? (
                <div
                  style={{
                    paddingLeft: 23,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "var(--ink-muted)",
                  }}
                >
                  {c.note}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          paddingTop: 11,
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
          {decided
            ? `Decidido em ${decided.decidedAt.toLocaleDateString("pt-BR")}${decided.cycle > 0 ? ` · ciclo ${decided.cycle + 1}` : ""}`
            : "Sem decisão registrada"}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: decided ? "var(--green-text)" : "var(--amber-text)",
          }}
        >
          {met}/{criteria.length} atendidos
        </span>
      </div>

      {notice ? (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: "11px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--red-soft)",
            border: "1px solid rgba(var(--red-rgb),.28)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--ink)",
            }}
          >
            {notice.message}
          </p>
          {notice.blockers.length > 0 ? (
            <ul
              style={{
                margin: "8px 0 0",
                paddingLeft: 18,
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--ink-muted)",
              }}
            >
              {notice.blockers.map((k) => (
                <li key={k}>{statementOf(k)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {decidable ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {phase.state === "BLOCKED" && notice && notice.blockers.length > 0 ? (
            <>
              {canOverride || !overrideReason ? null : (
                <span
                  id="gate-override-reason"
                  style={{
                    alignSelf: "center",
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    flex: "1 1 200px",
                  }}
                >
                  {overrideReason}
                </span>
              )}
              <GatedButton
                allowed={canOverride && !busy}
                icon="shield"
                onClick={() => onOverride(notice.blockers)}
                reason={canOverride ? "" : (overrideReason ?? "Sem permissão.")}
                variant="secondary"
              >
                Registrar override
              </GatedButton>
            </>
          ) : null}
          {closeBlockedReason ? (
            <span
              id="gate-close-reason"
              style={{
                alignSelf: "center",
                fontSize: 12,
                color: "var(--ink-muted)",
                flex: "1 1 200px",
              }}
            >
              {closeBlockedReason}
            </span>
          ) : null}
          <Button
            disabled={busy || Boolean(closeBlockedReason)}
            icon="check"
            onClick={() => onClose(factsToSend())}
            size="sm"
            title={closeBlockedReason ?? undefined}
          >
            Revisar e assinar
          </Button>
        </div>
      ) : null}

      {closed ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 12,
            justifyContent: "flex-end",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {canReopen || !reopenReason ? null : (
            <span
              id="gate-reopen-reason"
              style={{
                fontSize: 12,
                color: "var(--ink-muted)",
                flex: "1 1 200px",
              }}
            >
              {reopenReason}
            </span>
          )}
          <GatedButton
            allowed={canReopen && !busy}
            icon="refresh"
            onClick={onReopen}
            reason={canReopen ? "" : (reopenReason ?? "Sem permissão.")}
            variant="secondary"
          >
            Reabrir fase
          </GatedButton>
        </div>
      ) : null}

      {decided?.override && (
        <div
          style={{
            marginTop: 12,
            padding: "11px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--amber-soft)",
            border: "1px solid rgba(var(--amber-rgb),.28)",
          }}
        >
          <Eyebrow style={{ marginBottom: 6 }}>
            Override registrado · imutável (SG-07)
          </Eyebrow>
          <div
            style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 6 }}
          >
            Critérios dispensados:{" "}
            <strong style={{ color: "var(--ink)" }}>
              {decided.override.unmetCriteria.join(", ")}
            </strong>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            {decided.override.rationale}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
