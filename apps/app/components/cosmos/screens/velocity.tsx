"use client";

// velocity.tsx — Velocity, wired to listRecentSprints() + listTeamPredictability().
// Committed (capacity) vs. delivered (velocity) per closed sprint, RF-77
// benchmark line at 80%, plus per-team predictability.
import { useState } from "react";
import {
  listRecentSprints,
  listTeamPredictability,
  type SprintView,
  type TeamPredictabilityView,
} from "@/app/(cosmos)/actions/velocity";
import { EmptyState } from "../empty-state";
import {
  Badge,
  ChartTip,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useAction,
} from "../kit";

function ratioTone(pct: number | null): Tone {
  if (pct === null) {
    return "neutral";
  }
  if (pct >= 80) {
    return "green";
  }
  if (pct >= 60) {
    return "amber";
  }
  return "red";
}

function CommittedVsDeliveredChart({ sprints }: { sprints: SprintView[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Sprints come newest-first from the action; a time series reads left-to-right.
  const ordered = [...sprints].reverse();
  const max =
    Math.max(
      1,
      ...ordered.map((s) => Math.max(s.capacity ?? 0, s.velocity ?? 0))
    ) * 1.12;

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
          height: 200,
          padding: "0 2px",
        }}
      >
        {ordered.map((s, i) => {
          const c = s.capacity ?? 0;
          const v = s.velocity ?? 0;
          const hit = c > 0 ? v >= c * 0.95 : true;
          const hot = hover === i;
          return (
            <div
              className="chart-hit"
              key={s.id}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                height: "100%",
                justifyContent: "flex-end",
                opacity: hover !== null && !hot ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 46,
                  height: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {/* committed (ghost) */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    width: "100%",
                    height: `${(c / max) * 100}%`,
                    borderRadius: "6px 6px 0 0",
                    border: `1.5px dashed ${hot ? "var(--ink-muted)" : "var(--hairline-strong)"}`,
                    background: "var(--surface-2)",
                  }}
                />
                {/* delivered (solid) */}
                <div
                  style={{
                    position: "relative",
                    width: "70%",
                    height: `${(v / max) * 100}%`,
                    borderRadius: "5px 5px 0 0",
                    background: hit ? "var(--green)" : "var(--amber)",
                    boxShadow: `0 0 ${hot ? 16 : 10}px rgba(var(--${hit ? "green" : "amber"}-rgb),.4)`,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      position: "absolute",
                      top: -18,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: hit ? "var(--green-text)" : "var(--amber-text)",
                    }}
                  >
                    {v}
                  </span>
                </div>
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: hot ? "var(--ink)" : "var(--ink-subtle)",
                  fontWeight: hot ? 800 : 600,
                }}
              >
                {s.name}
              </span>
            </div>
          );
        })}
      </div>
      {hover !== null && (
        <ChartTip left={((hover + 0.5) / ordered.length) * 100} top={0}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {ordered[hover].name}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span>
              Committed <b className="mono">{ordered[hover].capacity ?? "—"}</b>
            </span>
            <span>
              Delivered <b className="mono">{ordered[hover].velocity ?? "—"}</b>
            </span>
          </div>
        </ChartTip>
      )}
      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: 14,
          justifyContent: "center",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "var(--ink-muted)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              border: "1.5px dashed var(--hairline-strong)",
              background: "var(--surface-2)",
            }}
          />
          Committed
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "var(--ink-muted)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              background: "var(--green)",
            }}
          />
          Delivered (no alvo)
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "var(--ink-muted)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 16,
              height: 11,
              borderRadius: 3,
              background: "var(--amber)",
            }}
          />
          Delivered (abaixo)
        </span>
      </div>
    </div>
  );
}

function CommittedVsDeliveredCard({
  sprints,
  loading,
  error,
}: {
  sprints: SprintView[] | undefined;
  loading: boolean;
  error: boolean;
}) {
  const withData = (sprints ?? []).filter(
    (s) => s.capacity !== null && s.velocity !== null
  );
  return (
    <SectionCard
      icon="barChart"
      subtitle="Story points por sprint"
      title="Committed vs. Delivered"
      tone="accent"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && withData.length === 0 && (
        <EmptyState
          description="O gráfico aparece assim que uma sprint for fechada com capacidade e velocity registradas."
          icon="barChart"
          title="Nenhuma sprint fechada ainda"
        />
      )}
      {!(error || loading) && withData.length > 0 && (
        <CommittedVsDeliveredChart sprints={withData} />
      )}
    </SectionCard>
  );
}

function TeamPredictabilityCard() {
  const { data, loading, error } = useAction<TeamPredictabilityView[]>(
    listTeamPredictability
  );
  const teams = (data ?? []).slice(0, 5);

  return (
    <SectionCard
      icon="gauge"
      subtitle="Aderência média ao committed, por time"
      title="Predictability por time"
      tone="green"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && teams.length === 0 && (
        <EmptyState
          description="Aparece quando algum time tiver sprints fechadas com capacidade e velocity registradas."
          icon="gauge"
          title="Sem dados de predictability ainda"
        />
      )}
      {!(error || loading) && teams.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {teams.map((t) => (
            <div key={t.teamId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {t.teamName}
                </span>
                <span
                  className="mono"
                  style={{
                    fontWeight: 700,
                    color:
                      t.predictabilityPct >= 90
                        ? "var(--green-text)"
                        : "var(--amber-text)",
                  }}
                >
                  {t.predictabilityPct}%
                </span>
              </div>
              <Progress
                height={7}
                tone={t.predictabilityPct >= 90 ? "green" : "amber"}
                value={Math.min(100, t.predictabilityPct)}
              />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default function VelocityScreen() {
  const { data: sprints, loading, error } = useAction(listRecentSprints);
  const closed = sprints ?? [];
  const withRatio = closed.filter((s) => s.sayDoRatioPct !== null);
  const velocities = closed
    .map((s) => s.velocity)
    .filter((v): v is number => v !== null);

  const avgVelocity =
    velocities.length > 0
      ? Math.round(
          velocities.reduce((sum, v) => sum + v, 0) / velocities.length
        )
      : null;

  const avgPredictability =
    withRatio.length > 0
      ? Math.round(
          withRatio.reduce((sum, s) => sum + (s.sayDoRatioPct ?? 0), 0) /
            withRatio.length
        )
      : null;

  // closed[0] is the most recent sprint (listRecentSprints orders endDate desc)
  const lastSprint = closed[0];
  const trendDelta =
    closed.length >= 2 &&
    closed[0].velocity !== null &&
    closed[1].velocity !== null &&
    closed[1].velocity > 0
      ? Math.round(
          ((closed[0].velocity - closed[1].velocity) / closed[1].velocity) * 100
        )
      : null;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Analytics"
        meta={<Badge tone="accent">{closed.length} sprints</Badge>}
        subtitle="Say-do ratio (comprometido vs. entregue) — benchmark ≥ 80%."
        title="Velocity"
      />
      {error && <ErrorState />}
      {!error && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <KpiCard
              hint="por sprint"
              icon="activity"
              label="Velocity média"
              tone="blue"
              unit={avgVelocity !== null ? "SP" : undefined}
              value={avgVelocity ?? "—"}
            />
            <KpiCard
              hint="entregue vs. committed"
              icon="gauge"
              label="Predictability"
              tone="green"
              unit={avgPredictability !== null ? "%" : undefined}
              value={avgPredictability ?? "—"}
            />
            <KpiCard
              hint={
                typeof lastSprint?.capacity === "number"
                  ? `de ${lastSprint.capacity} committed`
                  : "sem sprint fechada"
              }
              icon="trendingUp"
              label="Último sprint entregue"
              tone="accent"
              unit={typeof lastSprint?.velocity === "number" ? "SP" : undefined}
              value={lastSprint?.velocity ?? "—"}
            />
            <KpiCard
              hint="vs. sprint anterior"
              icon="zap"
              label="Tendência"
              tone={trendDelta !== null && trendDelta < 0 ? "red" : "purple"}
              unit={trendDelta !== null ? "%" : undefined}
              value={
                trendDelta !== null
                  ? `${trendDelta > 0 ? "+" : ""}${trendDelta}`
                  : "—"
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 14,
            }}
          >
            <CommittedVsDeliveredCard
              error={error}
              loading={loading}
              sprints={sprints}
            />
            <TeamPredictabilityCard />
          </div>
        </>
      )}

      {!error && (
        <div style={{ marginTop: 14 }}>
          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="trendingUp"
            title="Sprints recentes"
            tone="accent"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!loading && closed.length === 0 && (
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  Nenhum sprint encerrado ainda.
                </span>
              )}
              {closed.map((s) => {
                const tone = ratioTone(s.sayDoRatioPct);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 160px 70px",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid var(--hairline)",
                      background: "var(--surface)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 12.5, color: "var(--ink-muted)" }}
                    >
                      {s.velocity ?? "—"} / {s.capacity ?? "—"} SP
                    </span>
                    <Progress tone={tone} value={s.sayDoRatioPct ?? 0} />
                    <Badge tone={tone}>
                      {s.sayDoRatioPct !== null ? `${s.sayDoRatioPct}%` : "—"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
