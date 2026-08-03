"use client";

// piplanning.tsx — PI Planning (confidence vote, objectives, ROAM risks),
// wired to getActivePiPlanning(). O fist-of-five é do ART inteiro, não por
// time: ConfidenceVoteTally é uma linha de contagens por rodada, sem nenhuma
// coluna que ligue voto a votante (story-060, "Jornada do usuário").

import { useCallback, useEffect, useState } from "react";
import {
  type ConfidenceVoteView,
  castConfidenceVote,
  getActivePiPlanning,
  type PiPlanningView,
  revealTally,
} from "@/app/(cosmos)/actions/piplanning";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
} from "../kit";
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
        <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
          Nenhuma rodada de confidence vote aberta.
        </span>
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
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                Placar {vote.aggregateScore?.toFixed(1) ?? "—"} de 5
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
                Resultado escondido até a revelação
              </span>
            )}
          </div>

          {vote.revealed && vote.histogram ? (
            <div>
              <div
                style={{
                  fontSize: 11.5,
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
                        fontSize: 12,
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
                      style={{ fontSize: 12, color: "var(--ink-subtle)" }}
                    >
                      {count} voto{count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
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
              hint="fist-of-five"
              icon="gauge"
              label="Confiança média"
              tone="accent"
              unit="/5"
              value={
                plan.confidenceAvg === null
                  ? "—"
                  : plan.confidenceAvg.toFixed(1)
              }
            />
            <KpiCard
              hint={`${plan.risks.length} no ROAM`}
              icon="alert"
              label="Riscos a endereçar"
              tone="amber"
              value={openRisks}
            />
          </div>

          <div style={{ marginBottom: "var(--gap)" }}>
            <ConfidenceVoteCard onChanged={load} vote={plan.confidenceVote} />
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
                          fontSize: 13.5,
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
                          fontSize: 21,
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
                          fontSize: 10,
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
                  <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
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
                        fontSize: 12.5,
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
                  <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
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
                            fontSize: 12,
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
                            fontSize: 12,
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
                  <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
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
