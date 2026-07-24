"use client";

// team-detail-client.tsx — team drilldown (design handoff screen-bundle-4.jsx
// TeamDetailScreen). Real data only:
//   - Velocity by sprint: Sprint.capacity/velocity for this team, same chart
//     style as velocity.tsx's Committed vs. Delivered chart (a9afe38).
//   - Features · time: Feature.assignedTeamId, not filtered to a PI — no
//     "current PI" concept exists for team screens, so filtering would guess.
//   - Load bar + KPIs: TeamCapacitySnapshot (expected/actual SP, utilization).
//   - PI Objectives: PIObjective.teamId, most recent rows.
// Deferred, honestly, not fabricated: the handoff's PI burnup (needs a
// day-by-day scope/completed series — no writer exists, same gap as
// foundation item (b) in the remaining-work plan) and the squad
// contribution heatmap (needs per-member GitHub commit data — not
// ingested anywhere; GitHubDeploymentEvent tracks deployments, not
// commits). Both are omitted rather than shown with fabricated curves.
import { useState } from "react";
import type { TeamDetailView } from "@/app/(cosmos)/actions/teams";
import { EmptyState } from "../empty-state";
import {
  Badge,
  ChartTip,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useNav,
} from "../kit";

const STATUS_TONE: Record<string, Tone> = {
  DONE: "green",
  IN_PROGRESS: "accent",
  BACKLOG: "neutral",
};

const OBJECTIVE_TONE: Record<string, Tone> = {
  ACHIEVED: "green",
  IN_PROGRESS: "accent",
  MISSED: "red",
  NOT_STARTED: "neutral",
};

function TeamVelocityChart({
  sprints,
  tone,
}: {
  sprints: TeamDetailView["sprints"];
  tone: Tone;
}) {
  const [hover, setHover] = useState<number | null>(null);
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
          height: 180,
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
                  maxWidth: 40,
                  height: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
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
                <div
                  style={{
                    position: "relative",
                    width: "70%",
                    height: `${(v / max) * 100}%`,
                    borderRadius: "5px 5px 0 0",
                    background: hit ? `var(--${tone})` : "var(--amber)",
                    boxShadow: `0 0 ${hot ? 16 : 10}px rgba(var(--${hit ? tone : "amber"}-rgb),.4)`,
                  }}
                />
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
    </div>
  );
}

export default function TeamDetailClient({
  initial,
}: {
  initial: TeamDetailView;
}) {
  const { navigate } = useNav();
  const t = initial;
  const tone: Tone = "accent";

  const closedSprints = t.sprints.filter(
    (s) => s.capacity !== null && s.velocity !== null
  );
  const velocities = closedSprints
    .map((s) => s.velocity)
    .filter((v): v is number => v !== null);
  const avgVelocity =
    velocities.length > 0
      ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
      : t.velocity;

  const ratios = closedSprints
    .filter((s) => (s.capacity ?? 0) > 0)
    .map((s) => ((s.velocity as number) / (s.capacity as number)) * 100);
  const avgPredictability =
    ratios.length > 0
      ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length)
      : null;

  const latestCapacity = t.recentCapacity[0] ?? null;
  const overCapacity =
    latestCapacity !== null &&
    latestCapacity.actualSp > latestCapacity.expectedSp;

  const doneFeatures = t.features.filter((f) => f.statusId === "DONE").length;

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Portfolio · Time" title={t.name} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          icon="users"
          label="Membros"
          tone="purple"
          value={t.members.length}
        />
        <KpiCard
          hint="por sprint"
          icon="trendingUp"
          label="Velocity média"
          tone="green"
          unit={avgVelocity !== null ? "SP" : undefined}
          value={avgVelocity ?? "—"}
        />
        <KpiCard
          hint="entregue vs. committed"
          icon="gauge"
          label="Predictability"
          tone={
            avgPredictability !== null && avgPredictability >= 80
              ? "green"
              : "amber"
          }
          unit={avgPredictability !== null ? "%" : undefined}
          value={avgPredictability ?? "—"}
        />
        <KpiCard
          hint={
            latestCapacity
              ? `${latestCapacity.actualSp}/${latestCapacity.expectedSp} pts`
              : "sem snapshot ainda"
          }
          icon="layers"
          label="Capacidade"
          tone={overCapacity ? "red" : "accent"}
          unit={latestCapacity ? "%" : undefined}
          value={latestCapacity?.utilizationPct ?? "—"}
        />
        <KpiCard
          hint={`${t.features.length - doneFeatures} em andamento`}
          icon="check"
          label="Features"
          tone="blue"
          value={`${doneFeatures}/${t.features.length}`}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <SectionCard
          icon="barChart"
          subtitle="Story points por sprint (encerradas)"
          title="Velocity por sprint"
          tone={tone}
        >
          {closedSprints.length === 0 ? (
            <EmptyState
              description="O gráfico aparece assim que uma sprint deste time for fechada com capacidade e velocity registradas."
              icon="barChart"
              title="Nenhuma sprint fechada ainda"
            />
          ) : (
            <TeamVelocityChart sprints={closedSprints} tone={tone} />
          )}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="target"
            subtitle={`${t.piObjectives.length} objetivos`}
            title="PI Objectives"
            tone="purple"
          >
            {t.piObjectives.length === 0 ? (
              <EmptyState
                description="Nenhum PIObjective vinculado a este time ainda."
                icon="target"
                title="Sem PI Objectives"
              />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {t.piObjectives.map((o) => (
                  <div key={o.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        {o.title}
                      </span>
                      <Badge tone={OBJECTIVE_TONE[o.status] ?? "neutral"}>
                        {o.status}
                      </Badge>
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--ink-faint)" }}
                    >
                      BV {o.businessValue} · {o.achievedValue}/{o.plannedValue}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="layers"
            title="Carga de capacidade"
            tone={overCapacity ? "red" : tone}
          >
            {latestCapacity === null ? (
              <EmptyState
                description="Nenhum TeamCapacitySnapshot registrado para este time ainda."
                icon="layers"
                title="Sem snapshot de capacidade"
              />
            ) : (
              <>
                <Progress
                  tone={overCapacity ? "red" : tone}
                  value={latestCapacity.utilizationPct}
                />
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: "var(--ink-subtle)" }}>
                    {latestCapacity.actualSp} pts entregues
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontWeight: 800,
                      color: overCapacity
                        ? "var(--red-text)"
                        : "var(--ink-muted)",
                    }}
                  >
                    {overCapacity
                      ? `+${latestCapacity.actualSp - latestCapacity.expectedSp} acima do esperado`
                      : `${latestCapacity.expectedSp - latestCapacity.actualSp} pts abaixo do esperado`}
                  </span>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard
          bodyStyle={{ padding: "12px 16px" }}
          icon="kanban"
          subtitle={`${t.features.length} itens`}
          title="Features do time"
          tone="blue"
        >
          {t.features.length === 0 ? (
            <EmptyState
              description="Nenhuma feature atribuída a este time ainda (Feature.assignedTeamId)."
              icon="kanban"
              title="Nenhuma feature atribuída"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {t.features.map((f) => (
                <button
                  className="lift"
                  key={f.id}
                  onClick={() => navigate("feature", f.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 60px",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 10px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                    textAlign: "left",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                      minWidth: 0,
                    }}
                  >
                    {f.title}
                  </span>
                  <Badge tone={STATUS_TONE[f.statusId] ?? "neutral"}>
                    {f.statusId}
                  </Badge>
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--ink-muted)" }}
                  >
                    {f.progressPct}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          bodyStyle={{ padding: "12px 16px" }}
          icon="users"
          subtitle={`${t.members.length} itens`}
          title="Membros"
          tone="accent"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {t.members.map((m) => (
              <div
                key={`${m.name}-${m.role}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
                >
                  {m.name}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  {m.role}
                </span>
              </div>
            ))}
            {t.members.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Nenhum membro cadastrado.
              </span>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
