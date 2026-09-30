"use client";

// Aba Relatório & Benchmark — US5. Port de `meridian-screens-3.jsx`.
//
// A regra que essa tela existe para honrar: coorte abaixo do mínimo não vira
// gráfico com ressalva — vira declaração de retenção. Mostrar comparação com
// amostra pequena seria estatística de mentira, e o relatório prefere dizer
// que reteve.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  Progress,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import {
  getReassessmentDiff,
  getReport,
  type ReassessmentDiff,
  type Report,
} from "@/app/(meridian)/actions/report";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { BENCH_THRESHOLD } from "@/lib/meridian/benchmark";
import { confTone, scoreTone } from "@/lib/meridian/composite";
import {
  ARCHETYPE_HINT,
  ARCHETYPE_LABEL,
  type ReadinessProfile,
} from "@/lib/meridian/readiness-bands";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Eyebrow,
  Legend,
  MetaCell,
  ModalShell,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  useMeridianData,
  useModal,
} from "../base";
import { BenchBand, Radar, ScoreRing } from "../charts";

function DiffModal({
  diff,
  onClose,
}: {
  diff: ReassessmentDiff;
  onClose: () => void;
}) {
  return (
    <ModalShell
      icon="diff"
      onClose={onClose}
      subtitle={`Run anterior fechado em ${diff.previousClosedAt ? new Date(diff.previousClosedAt).toLocaleDateString("pt-BR") : "—"} (template ${diff.previousTemplateVersion})`}
      title={`Diff vs. ${diff.previousCode}`}
      tone="accent"
      width={640}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {diff.templateChanged && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: 9,
              background: "var(--amber-soft)",
              border: "1px solid rgba(var(--amber-rgb),.3)",
              fontSize: 11.5,
              color: "var(--amber-text)",
              fontWeight: 600,
            }}
          >
            A versão de template mudou entre os dois runs — a comparação por
            eixo vale, mas pergunta a pergunta não.
          </div>
        )}

        <div>
          <Eyebrow tone="accent">Scores por eixo</Eyebrow>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              marginTop: 8,
            }}
          >
            {diff.axes.map((x) => (
              <div
                key={x.axis}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: 130,
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name={AXES[x.axis].icon}
                    size={12}
                    style={{ color: "var(--ink-faint)" }}
                  />
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                    {x.label}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-faint)",
                    width: 22,
                    textAlign: "right",
                  }}
                >
                  {x.was}
                </span>
                <span
                  style={{
                    flex: 1,
                    position: "relative",
                    height: 8,
                    borderRadius: 4,
                    background: "var(--surface-3)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${Math.min(x.was, x.now)}%`,
                      width: `${Math.abs(x.delta)}%`,
                      background: x.delta >= 0 ? "var(--green)" : "var(--red)",
                      opacity: 0.8,
                    }}
                  />
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    width: 22,
                    textAlign: "right",
                  }}
                >
                  {x.now}
                </span>
                <Badge tone={x.delta >= 0 ? "green" : "red"}>
                  {x.delta >= 0 ? "+" : ""}
                  {x.delta}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
          }}
        >
          <MetaCell
            label="Gaps resolvidos"
            mono
            tone="green"
            value={String(diff.resolved.length)}
          />
          <MetaCell
            label="Persistentes"
            mono
            tone="amber"
            value={diff.persisting.join(", ") || "—"}
          />
          <MetaCell
            label="Plan items"
            mono
            value={`${diff.planDelta.done} feitos · ${diff.planDelta.created} novos`}
          />
        </div>

        {diff.resolved.length > 0 && (
          <div>
            <Eyebrow tone="green">Resolvidos desde {diff.previousCode}</Eyebrow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 7,
              }}
            >
              {diff.resolved.map((r) => (
                <div
                  key={r.code}
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "flex-start",
                    padding: "8px 11px",
                    borderRadius: 8,
                    background: "var(--green-soft)",
                    border: "1px solid rgba(var(--green-rgb),.24)",
                  }}
                >
                  <Icon
                    name="check"
                    size={13}
                    style={{
                      color: "var(--green-text)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.statement}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/** Faixa do eixo por extenso. Eixo de confiança baixa mostra "Não confiável"
 *  (fato, em âmbar); as faixas usam o tom de categoria do produto, não a
 *  régua de verde/âmbar/vermelho do score. */
function BandBadge({
  band,
}: {
  band: ReadinessProfile["axes"][number] | undefined;
}) {
  if (!band) {
    return <span style={{ width: 104 }} />;
  }
  return (
    <span style={{ width: 104, display: "flex", justifyContent: "flex-end" }}>
      <Badge tone={band.reliable ? "blue" : "amber"}>{band.display}</Badge>
    </span>
  );
}

/** Padrão entre os eixos: arquétipo dominante e traço secundário. O score é
 *  instrução de sequência, não nota. */
function ArchetypeCard({ profile }: { profile: ReadinessProfile }) {
  const complete = profile.axes.length === AXIS_IDS.length;
  const { dominant, secondary, unreliableAxes } = profile;
  return (
    <SectionCard
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 10 }}
      icon="crosshair"
      subtitle="O score é instrução de sequência, não nota: a faixa diz por onde começar, o arquétipo diz que trilha o padrão pede"
      title="Arquétipo de prontidão"
    >
      {dominant ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge tone="accent">{ARCHETYPE_LABEL[dominant]}</Badge>
          </span>
          <p style={ARCHETYPE_TEXT}>{ARCHETYPE_HINT[dominant]}</p>
        </div>
      ) : (
        <p style={ARCHETYPE_TEXT}>
          {complete
            ? "Sem padrão dominante entre os eixos — a leitura é eixo a eixo."
            : "O arquétipo só aparece com os cinco eixos com score."}
        </p>
      )}
      {secondary && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={ARCHETYPE_TEXT}>Traço secundário</span>
            <Badge tone="purple">{ARCHETYPE_LABEL[secondary]}</Badge>
          </span>
          <p style={ARCHETYPE_TEXT}>{ARCHETYPE_HINT[secondary]}</p>
        </div>
      )}
      {unreliableAxes.length > 0 && (
        <p style={{ ...ARCHETYPE_TEXT, color: "var(--amber-text)" }}>
          Não confiável em {unreliableAxes.map((a) => AXES[a].label).join(", ")}
          : liderança e operação discordam. Revalide a faixa no workshop antes
          de usá-la.
        </p>
      )}
    </SectionCard>
  );
}

const ARCHETYPE_TEXT = {
  margin: 0,
  fontSize: 12,
  color: "var(--ink-muted)",
  fontWeight: 500,
  lineHeight: 1.55,
} as const;

export default function RelatorioTab({ a }: { a: AssessmentDetail }) {
  const modal = useModal();
  const fetcher = useCallback(() => getReport({ assessmentId: a.id }), [a.id]);
  const { data, loading, error, reload } = useMeridianData<Report>(fetcher);

  const openDiff = async () => {
    const res = await runWithToast(
      () => getReassessmentDiff({ assessmentId: a.id }),
      {
        loading: "Montando diff…",
        success: "Diff pronto.",
      }
    );
    if (res.ok) {
      modal.open(<DiffModal diff={res.data} onClose={modal.close} />);
    }
  };

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading || !data) {
    return <SkeletonCard />;
  }
  if (data.axes.length === 0) {
    return (
      <SmartEmptyState
        icon="gauge"
        subtitle="O relatório nasce do scoring finalizado — feche a coleta e conclua a revisão."
        title="Sem relatório ainda"
        tone="accent"
      />
    );
  }

  const r = data;
  const cohort = r.cohort;
  const bands = cohort && !cohort.withheld ? cohort.bands : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: "var(--gap)",
        alignItems: "start",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 14 }}
          icon="gauge"
          subtitle="Score final por eixo, com confiança — override marcado, não escondido"
          title="Shape de prontidão"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
              paddingBottom: 6,
              borderBottom: "1px dashed var(--hairline)",
            }}
          >
            <Radar
              bands={bands}
              scores={r.axes.map((x) => ({ axis: x.axis, score: x.score }))}
            />
            <div
              style={{
                flex: "1 1 200px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {r.composite !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <ScoreRing label="Composite" size={64} value={r.composite} />
                  <div>
                    <Eyebrow tone="accent">Composite</Eyebrow>
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        fontSize: 10,
                        color: "var(--ink-faint)",
                        marginTop: 3,
                      }}
                    >
                      template {r.templateVersion} · {r.sector}
                    </span>
                  </div>
                </div>
              )}
              {r.axes.some((x) => x.overridden) && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  Um ou mais eixos passaram por override do consultor — o
                  relatório diz isso, sem hedge.
                </p>
              )}
              {bands && (
                <Legend
                  items={[
                    { label: "Sua organização", tone: "accent" },
                    { label: "Mediana da coorte (p50)", tone: "neutral" },
                  ]}
                />
              )}
            </div>
          </div>

          {r.axes.map((x) => (
            <div
              key={x.axis}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  width: 150,
                  flexShrink: 0,
                }}
              >
                <Icon
                  name={AXES[x.axis].icon}
                  size={13}
                  style={{ color: "var(--ink-faint)" }}
                />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{x.label}</span>
              </span>
              <span style={{ flex: 1 }}>
                <Progress
                  height={8}
                  tone={scoreTone(x.score)}
                  value={x.score}
                />
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  width: 26,
                  textAlign: "right",
                  color: `var(--${scoreTone(x.score)}-text)`,
                }}
              >
                {x.score}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  width: 68,
                  textAlign: "right",
                  color: `var(--${confTone(x.confidence)}-text)`,
                }}
              >
                conf {Math.round(x.confidence * 100)}%
              </span>
              <BandBadge
                band={r.readiness.axes.find((b) => b.axis === x.axis)}
              />
              {x.overridden ? (
                <Badge tone="purple">override</Badge>
              ) : (
                <span style={{ width: 58 }} />
              )}
            </div>
          ))}

          <Legend
            items={[
              { label: "≥70 pronto", tone: "green" },
              { label: "50–69 em construção", tone: "amber" },
              { label: "<50 crítico", tone: "red" },
            ]}
          />
        </SectionCard>

        <ArchetypeCard profile={r.readiness} />

        {cohort && (
          <SectionCard
            bodyStyle={{ display: "flex", flexDirection: "column", gap: 13 }}
            icon="activity"
            subtitle={
              cohort.withheld
                ? undefined
                : `n = ${cohort.n} organizações · banda p25–p75, traço = mediana`
            }
            title={`Benchmark — ${cohort.cohortKey}`}
            tone={cohort.withheld ? "amber" : "accent"}
          >
            {cohort.withheld ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  borderRadius: "var(--r-md)",
                  background: "var(--amber-soft)",
                  border: "1px solid rgba(var(--amber-rgb),.35)",
                }}
              >
                <Icon
                  name="ban"
                  size={17}
                  style={{
                    color: "var(--amber-text)",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <div>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "var(--amber-text)",
                    }}
                  >
                    Comparação retida
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--ink-muted)",
                      fontWeight: 500,
                      lineHeight: 1.6,
                    }}
                  >
                    A coorte "{cohort.cohortKey}" tem n = {cohort.n}, abaixo do
                    mínimo de {BENCH_THRESHOLD}. Mostrar comparação com amostra
                    pequena seria estatística de mentira — o relatório declara a
                    retenção em vez de desenhar o gráfico.
                  </p>
                </div>
              </div>
            ) : (
              AXIS_IDS.filter((x) => r.axes.some((s) => s.axis === x)).map(
                (x) => (
                  <BenchBand
                    axis={x}
                    band={(bands as NonNullable<typeof bands>)[x]}
                    key={x}
                    mine={r.axes.find((s) => s.axis === x)?.score ?? 0}
                  />
                )
              )
            )}
          </SectionCard>
        )}
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 10 }}
          icon="upload"
          title="Entrega ao patrocinador"
          tone="accent"
        >
          <Button
            disabled={!r.isReassessment}
            icon="diff"
            onClick={openDiff}
            variant="secondary"
          >
            {r.isReassessment
              ? "Diff vs. run anterior"
              : "Primeiro run — sem diff"}
          </Button>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--ink-faint)",
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            O relatório apresenta override como decisão fundamentada do
            consultor — visível, com justificativa. O patrocinador apresenta sem
            hedge.
          </p>
        </SectionCard>

        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 9 }}
          icon="target"
          subtitle="Os três de maior custo de atraso"
          title="Narrativa dos gaps"
        >
          {r.topGaps.length === 0 ? (
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-subtle)",
                fontWeight: 500,
              }}
            >
              Nenhum gap derivado neste run.
            </span>
          ) : (
            r.topGaps.map((g) => (
              <div
                key={g.code}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 12px",
                  borderRadius: 9,
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--ink-faint)",
                    }}
                  >
                    {g.code}
                  </span>
                  <span
                    className="mono"
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--amber-text)",
                    }}
                  >
                    CoD {g.costOfDelay}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    lineHeight: 1.5,
                  }}
                >
                  {g.statement}
                </span>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 0 }}
          icon="history"
          title="Trilha de auditoria"
        >
          {r.trail.map((t, i) => (
            <div
              key={`${t.when}-${i}`}
              style={{
                display: "flex",
                gap: 10,
                padding: "8px 2px",
                borderBottom:
                  i < r.trail.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--ink-faint)",
                  width: 92,
                  flexShrink: 0,
                  lineHeight: 1.6,
                }}
              >
                {new Date(t.when).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {t.what}
              </span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
