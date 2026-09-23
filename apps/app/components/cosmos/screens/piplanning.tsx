"use client";

// piplanning.tsx — PI Planning (confidence vote, objectives, ROAM risks),
// wired to getActivePiPlanning(). O fist-of-five é do ART inteiro, não por
// time: ConfidenceVoteTally é uma linha de contagens por rodada, sem nenhuma
// coluna que ligue voto a votante (story-060, "Jornada do usuário").

import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import {
  abrirRodadaDeConfianca,
  type ConfidenceVoteView,
  castConfidenceVote,
  getActivePiPlanning,
  type PiPlanningView,
  revealTally,
} from "@/app/(cosmos)/actions/piplanning";
import { transitionPIPlan } from "@/app/actions/arts/lifecycle";
import { FormField, TextArea } from "../modal-form";
import { useActionToast } from "../use-action-toast";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "amber",
  ACHIEVED: "green",
  MISSED: "red",
};

const ROAM_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  UNCLASSIFIED: "neutral",
  RESOLVED: "green",
  OWNED: "amber",
  ACCEPTED: "neutral",
  MITIGATED: "green",
};

const FIST_OF_FIVE = [1, 2, 3, 4, 5] as const;

// story-060 AC-001/AC-003/AC-004 — o voto e a revelação a partir do painel do
// PI ativo. A distribuição só aparece depois da revelação: resultado parcial
// visível muda o voto de quem ainda não votou.
function ConfidenceVoteCard({
  vote,
  onChanged,
}: {
  vote: ConfidenceVoteView | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const cast = async (score: number) => {
    if (busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => castConfidenceVote({ score }), {
      loading: "Registrando voto...",
      success: "Voto registrado — anônimo, como manda a cerimônia.",
      error: (err: string) => `Não foi possível votar: ${err}`,
    });
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  // O passo que não existia: sem alguém abrir a rodada, o card só sabia dizer
  // que não havia rodada — e não havia como haver.
  const abrir = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => abrirRodadaDeConfianca(), {
      loading: "Abrindo rodada...",
      success: (d: {
        round: number;
        participantCount: number;
        jaAberta: boolean;
      }) =>
        d.jaAberta
          ? `A rodada ${d.round} já estava aberta.`
          : `Rodada ${d.round} aberta para ${d.participantCount} participante${d.participantCount === 1 ? "" : "s"}.`,
      error: (err: string) => `Não foi possível abrir a rodada: ${err}`,
    });
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  const reveal = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => revealTally(), {
      loading: "Revelando resultado...",
      success: "Resultado revelado.",
      error: (err: string) => `Não foi possível revelar: ${err}`,
    });
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  return (
    <SectionCard
      action={vote && <Badge tone="neutral">Rodada {vote.round}</Badge>}
      bodyStyle={{ padding: 14 }}
      icon="gauge"
      subtitle="Fist-of-five do ART · voto anônimo, agregado por rodada"
      title="Confidence vote"
    >
      {vote === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span
            style={{ fontSize: "var(--fs-base)", color: "var(--ink-subtle)" }}
          >
            Nenhuma rodada de confidence vote aberta. Quem facilita a cerimônia
            abre a rodada; o voto é de todo o ART.
          </span>
          <div>
            <Button onClick={abrir} size="sm" variant="primary">
              Abrir rodada de confiança
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Badge dot tone={vote.revealed ? "green" : "amber"}>
              {vote.totalVotes} de {vote.participantCount} já votaram
            </Badge>
            {vote.revealed ? (
              <span
                style={{
                  fontSize: "var(--fs-base)",
                  color: "var(--ink-muted)",
                }}
              >
                Placar {vote.aggregateScore?.toFixed(1) ?? "—"} de 5
              </span>
            ) : (
              <span
                style={{
                  fontSize: "var(--fs-base)",
                  color: "var(--ink-subtle)",
                }}
              >
                Resultado escondido até a revelação
              </span>
            )}
          </div>

          {vote.revealed && vote.histogram ? (
            <div>
              <div
                style={{
                  fontSize: "var(--fs-nota)",
                  fontWeight: 700,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                  marginBottom: 8,
                }}
              >
                Distribuição dos votos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {vote.histogram.map((count, index) => (
                  <div
                    key={FIST_OF_FIVE[index]}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-base)",
                        fontWeight: 700,
                        color: "var(--ink-muted)",
                        width: 14,
                      }}
                    >
                      {FIST_OF_FIVE[index]}
                    </span>
                    <div style={{ flex: 1 }}>
                      <Progress
                        tone={index >= 2 ? "green" : "amber"}
                        value={
                          vote.totalVotes > 0
                            ? Math.round((count / vote.totalVotes) * 100)
                            : 0
                        }
                      />
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-base)",
                        color: "var(--ink-subtle)",
                      }}
                    >
                      {count} voto{count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
              {/* Confiança baixa não é impasse: em SAFe o ART replaneja e vota
                  de novo. Sem esta saída, a única alternativa ao commit forçado
                  seria abandonar a cerimônia. */}
              <div style={{ marginTop: 12 }}>
                <Button onClick={abrir} size="sm" variant="secondary">
                  Abrir nova rodada
                </Button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {FIST_OF_FIVE.map((score) => (
                <Button
                  key={score}
                  onClick={() => cast(score)}
                  size="sm"
                  variant="secondary"
                >
                  Votar {score}
                </Button>
              ))}
              <Button onClick={reveal} size="sm" variant="primary">
                Revelar resultado
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// O portão de compromisso fala em código de erro (`COMMITMENT_GATE_FAILED:
// LOW_CONFIDENCE:1:required:3`) porque é contrato de action. Quem está na sala
// da cerimônia precisa da frase, e de uma frase que diga o que fazer a seguir.
function traduzirRecusa(erro: string, limite: number): string[] {
  const marca = "COMMITMENT_GATE_FAILED:";
  if (erro.startsWith("FORCE_COMMIT_REASON_TOO_SHORT")) {
    return ["A justificativa precisa de pelo menos 20 caracteres."];
  }
  if (erro.startsWith("FORCE_COMMIT_PREREQUISITES_NOT_MET")) {
    return [
      "Commit forçado não dispensa objetivos sem valor planejado nem riscos sem ROAM — só o limite de confiança.",
    ];
  }
  if (!erro.startsWith(marca)) {
    return [erro];
  }
  return erro
    .slice(marca.length)
    .split("|")
    .map((parte) => {
      const [chave, valor, , exigido] = parte.split(":");
      if (chave === "MISSING_PLANNED_VALUE") {
        return `${valor} objetivo(s) sem valor planejado.`;
      }
      if (chave === "UNROAMED_RISKS") {
        return `${valor} risco(s) ainda sem classificação ROAM.`;
      }
      if (chave === "LOW_CONFIDENCE") {
        return `Confiança de ${Number(valor).toFixed(1)} abaixo do mínimo de ${exigido ?? limite} do ART.`;
      }
      return parte;
    });
}

const ROTULO_DA_TRANSICAO = {
  COMMIT: {
    loading: "Comprometendo o PI...",
    sucesso: "PI comprometido pelo ART.",
  },
  FORCE_COMMIT: {
    loading: "Comprometendo com justificativa...",
    sucesso: "PI comprometido por decisão registrada.",
  },
  START_EXECUTING: {
    loading: "Iniciando execução...",
    sucesso: "PI em execução.",
  },
  CLOSE: { loading: "Encerrando o PI...", sucesso: "PI encerrado." },
} as const;

type EventoDeCiclo = keyof typeof ROTULO_DA_TRANSICAO;

/**
 * O fecho da cerimônia, na tela onde a cerimônia acontece.
 *
 * `transitionPIPlan` já existia com quatro eventos e testes verdes; só
 * `OPEN_PLANNING` tinha botão, em /cosmos/arts. Comprometer e iniciar execução
 * não tinham chamador nenhum — a cerimônia começava no produto e terminava no
 * banco.
 */
function CompromissoCard({
  plan,
  onChanged,
}: {
  plan: PiPlanningView;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [recusas, setRecusas] = useState<string[]>([]);
  const [justificativa, setJustificativa] = useState("");
  const [confirmandoFecho, setConfirmandoFecho] = useState(false);

  const transitar = async (event: EventoDeCiclo, overrideReason?: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        transitionPIPlan({
          piPlanId: plan.piPlanId,
          event,
          ...(overrideReason ? { overrideReason } : {}),
        }),
      {
        loading: ROTULO_DA_TRANSICAO[event].loading,
        success: ROTULO_DA_TRANSICAO[event].sucesso,
        error: (err: string) =>
          traduzirRecusa(err, plan.confidenceThreshold).join(" "),
      }
    );
    setBusy(false);
    if (res.ok) {
      setRecusas([]);
      setJustificativa("");
      setConfirmandoFecho(false);
      onChanged();
      return;
    }
    setRecusas(traduzirRecusa(res.error, plan.confidenceThreshold));
  };

  const emPlanejamento = plan.piPlanStatus === "PLANNING";
  const comprometido = plan.piPlanStatus === "COMMITTED";
  const executando = plan.piPlanStatus === "EXECUTING";
  // O commit forçado só se oferece depois que o portão recusou por confiança:
  // atalho permanente convidaria a pular o voto, que é o ponto da cerimônia.
  const podeForcar = recusas.some((r) => r.startsWith("Confiança de"));

  return (
    <SectionCard
      action={
        <Badge tone={executando ? "green" : comprometido ? "accent" : "amber"}>
          {plan.piPlanStatus}
        </Badge>
      }
      bodyStyle={{ padding: 14 }}
      icon="target"
      subtitle="O compromisso do ART com o incremento — o fecho da cerimônia"
      title="Compromisso do PI"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span
          style={{ fontSize: "var(--fs-base)", color: "var(--ink-subtle)" }}
        >
          {emPlanejamento &&
            "Com os objetivos escritos, os riscos no ROAM e a confiança revelada, o ART assume o compromisso."}
          {comprometido &&
            "Compromisso assumido. Iniciar a execução libera o trabalho dos times nas sprints do PI."}
          {executando &&
            "PI em execução. Encerrar apura o valor entregue e congela os orçamentos do período."}
        </span>

        {recusas.length > 0 && (
          <div
            style={{
              background: "var(--amber-soft)",
              border: "1px solid rgba(var(--amber-rgb),.3)",
              borderRadius: "var(--r-md)",
              color: "var(--amber-text)",
              fontSize: "var(--fs-base)",
              lineHeight: 1.55,
              padding: "9px 11px",
            }}
          >
            {recusas.map((r) => (
              <div key={r}>{r}</div>
            ))}
          </div>
        )}

        {podeForcar && (
          <FormField
            hint="Fica registrada na trilha do PI, com autor e data"
            label="Justificativa para comprometer abaixo do limite"
            required
          >
            <TextArea
              maxLength={500}
              onChange={setJustificativa}
              placeholder="ex: o ART assume o risco da integração externa porque o cliente âncora depende da data"
              required
              rows={3}
              value={justificativa}
            />
          </FormField>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {emPlanejamento && (
            <Button
              onClick={() => transitar("COMMIT")}
              size="sm"
              variant="primary"
            >
              Comprometer o PI
            </Button>
          )}
          {/* O botão só existe com justificativa escrita: o portão exige 20
              caracteres, e um botão que aparece para recusar ensina menos do
              que um que aparece quando a decisão está pronta. */}
          {emPlanejamento &&
            podeForcar &&
            justificativa.trim().length >= 20 && (
              <Button
                onClick={() => transitar("FORCE_COMMIT", justificativa.trim())}
                size="sm"
                variant="secondary"
              >
                Comprometer mesmo assim
              </Button>
            )}
          {comprometido && (
            <Button
              onClick={() => transitar("START_EXECUTING")}
              size="sm"
              variant="primary"
            >
              Iniciar execução
            </Button>
          )}
          {executando &&
            (confirmandoFecho ? (
              <>
                <Button
                  onClick={() => transitar("CLOSE")}
                  size="sm"
                  variant="primary"
                >
                  Confirmar encerramento
                </Button>
                <Button
                  onClick={() => setConfirmandoFecho(false)}
                  size="sm"
                  variant="ghost"
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setConfirmandoFecho(true)}
                size="sm"
                variant="secondary"
              >
                Encerrar PI
              </Button>
            ))}
        </div>
      </div>
    </SectionCard>
  );
}

export default function PiPlanningScreen() {
  const [plan, setPlan] = useState<PiPlanningView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getActivePiPlanning().then((r) => {
      if (r.ok) {
        setPlan(r.data);
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const committedBV =
    plan?.objectives
      .filter((o) => !o.isStretch)
      .reduce((s, o) => s + o.businessValue, 0) ?? 0;
  const stretchBV =
    plan?.objectives
      .filter((o) => o.isStretch)
      .reduce((s, o) => s + o.businessValue, 0) ?? 0;
  const openRisks =
    plan?.risks.filter((r) => r.roamStatus === "OWNED").length ?? 0;
  const totalPlannedValue =
    plan?.objectives.reduce((s, o) => s + o.plannedValue, 0) ?? 0;
  const totalAchievedValue =
    plan?.objectives.reduce((s, o) => s + o.achievedValue, 0) ?? 0;
  const ppmPct =
    totalPlannedValue > 0
      ? Math.round((totalAchievedValue / totalPlannedValue) * 100)
      : null;

  return (
    <div className="fade-in" style={{ paddingBottom: 76 }}>
      <PageHeader
        meta={
          plan && (
            <Badge dot tone="accent">
              {plan.piPlanName}
            </Badge>
          )
        }
        subtitle="Planejamento incremental do ART. Confiança do time, objetivos e riscos ROAM."
        title="PI Planning"
      />

      {error && <ErrorState message={error} />}

      {!(error || loading) && plan === null && (
        <KpiCard
          hint="Nenhum PI em Planning, Committed ou Executing"
          icon="target"
          label="Nenhum PI ativo"
          tone="accent"
          value="—"
        />
      )}

      {plan && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: "var(--gap)",
              marginBottom: "var(--gap)",
            }}
          >
            <KpiCard
              hint={`${plan.objectives.filter((o) => !o.isStretch).length} objetivos`}
              icon="target"
              label="Business Value committed"
              tone="green"
              value={committedBV}
            />
            <KpiCard
              hint="não committed"
              icon="zap"
              label="Business Value stretch"
              tone="purple"
              value={stretchBV}
            />
            <KpiCard
              decimals={1}
              hint="fist-of-five"
              icon="gauge"
              label="Confiança média"
              tone="accent"
              unit="/5"
              value={plan.confidenceAvg ?? "—"}
            />
            <KpiCard
              hint={`${plan.risks.length} no ROAM`}
              icon="alert"
              label="Riscos a endereçar"
              tone="amber"
              value={openRisks}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--gap)",
              marginBottom: "var(--gap)",
            }}
          >
            <ConfidenceVoteCard onChanged={load} vote={plan.confidenceVote} />
            <CompromissoCard onChanged={load} plan={plan} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.45fr 1fr",
              gap: "var(--gap)",
            }}
          >
            {/* objectives */}
            <SectionCard
              action={
                <Badge tone="neutral">{plan.objectives.length} objetivos</Badge>
              }
              bodyStyle={{ padding: 12 }}
              icon="target"
              subtitle="Committed e stretch · com business value"
              title="PI Objectives"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.objectives.map((o) => (
                  <div
                    className="lift"
                    key={o.id}
                    style={{
                      display: "flex",
                      gap: 13,
                      alignItems: "center",
                      padding: "13px 14px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: o.isStretch
                        ? "var(--surface-2)"
                        : "var(--surface)",
                      opacity: o.isStretch ? 0.92 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Badge tone={STATUS_TONE[o.status] ?? "neutral"}>
                          {o.status}
                        </Badge>
                        {o.isStretch && <Badge tone="neutral">stretch</Badge>}
                        {o.teamName && (
                          <Badge tone="accent">{o.teamName}</Badge>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--fs-base)",
                          fontWeight: 600,
                          color: "var(--ink)",
                          lineHeight: 1.35,
                          textWrap: "pretty",
                        }}
                      >
                        {o.title}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: "var(--fs-display)",
                          fontWeight: 800,
                          color: o.isStretch
                            ? "var(--ink-faint)"
                            : "var(--green-text)",
                          letterSpacing: "-.02em",
                        }}
                      >
                        {o.businessValue}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--fs-micro)",
                          color: "var(--ink-subtle)",
                          fontWeight: 700,
                          letterSpacing: ".06em",
                        }}
                      >
                        BV
                      </div>
                    </div>
                  </div>
                ))}
                {plan.objectives.length === 0 && (
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      color: "var(--ink-subtle)",
                    }}
                  >
                    Nenhum objetivo cadastrado.
                  </span>
                )}
              </div>
            </SectionCard>

            {/* ROAM */}
            <SectionCard
              action={<Badge tone="amber">{openRisks} abertos</Badge>}
              bodyStyle={{ padding: 12 }}
              icon="alert"
              subtitle="Resolved · Owned · Accepted · Mitigated"
              title="Riscos · ROAM"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.risks.map((r) => (
                  <div
                    className="lift"
                    key={r.id}
                    style={{
                      padding: "12px 13px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Badge tone={ROAM_TONE[r.roamStatus] ?? "neutral"}>
                        {r.roamStatus}
                      </Badge>
                    </div>
                    <div
                      style={{
                        fontSize: "var(--fs-base)",
                        fontWeight: 500,
                        color: "var(--ink)",
                        lineHeight: 1.4,
                        textWrap: "pretty",
                      }}
                    >
                      {r.title}
                    </div>
                  </div>
                ))}
                {plan.risks.length === 0 && (
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      color: "var(--ink-subtle)",
                    }}
                  >
                    Nenhum risco cadastrado.
                  </span>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Business value: planned vs. actual */}
          <div style={{ marginTop: "var(--gap)" }}>
            <SectionCard
              action={
                <Badge
                  tone={ppmPct !== null && ppmPct >= 80 ? "green" : "amber"}
                >
                  {ppmPct === null ? "—" : `${ppmPct}%`} PPM
                </Badge>
              }
              bodyStyle={{ padding: 12 }}
              icon="gauge"
              subtitle="Program Predictability (PPM) · meta SAFe ≥ 80%"
              title="Business Value · Planejado vs. Realizado"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {plan.objectives.map((o) => {
                  const pct =
                    o.plannedValue > 0
                      ? Math.round((o.achievedValue / o.plannedValue) * 100)
                      : 0;
                  const hit = o.achievedValue >= o.plannedValue;
                  return (
                    <div
                      key={o.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--hairline)",
                        background: "var(--surface-2)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 7,
                        }}
                      >
                        {o.teamName ? (
                          <Badge dot tone="accent">
                            {o.teamName}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Sem time</Badge>
                        )}
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: "var(--fs-base)",
                            color: "var(--ink-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {o.title}
                        </span>
                        <span
                          className="mono"
                          style={{
                            flexShrink: 0,
                            fontSize: "var(--fs-base)",
                            fontWeight: 800,
                            color: hit
                              ? "var(--green-text)"
                              : "var(--amber-text)",
                          }}
                        >
                          {o.achievedValue} / {o.plannedValue} BV
                        </span>
                      </div>
                      <Progress tone={hit ? "green" : "amber"} value={pct} />
                    </div>
                  );
                })}
                {plan.objectives.length === 0 && (
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      color: "var(--ink-subtle)",
                    }}
                  >
                    Nenhum objetivo cadastrado.
                  </span>
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
