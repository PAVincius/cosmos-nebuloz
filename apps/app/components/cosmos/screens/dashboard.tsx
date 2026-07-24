// dashboard.tsx — Visão Geral (portfolio executive summary), ported from the
// cosmos handoff. KPI row, velocity area chart, predictability bars, theme
// allocation bars, and in-flight epics list. Every number on this screen is
// wired to a real tenant-scoped server action — see the commit body for the
// per-KPI/chart data source.

import { listLeanBudgets } from "@/app/(cosmos)/actions/budgets";
import { getCloudCostSummary } from "@/app/(cosmos)/actions/finops";
import { listEpics } from "@/app/(cosmos)/actions/kanban";
import {
  getActiveArtCount,
  getActivePiPlanning,
  listRecentPiPredictability,
} from "@/app/(cosmos)/actions/piplanning";
import { listRecentSprints } from "@/app/(cosmos)/actions/velocity";
import { ARTS } from "@/lib/cosmos-data";
import { EmptyState } from "../empty-state";
import {
  Badge,
  CopyId,
  KpiCard,
  NavButton,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
} from "../kit";
import {
  AnomaliesCopilotBar,
  AreaChart,
  EpicRow,
  OrbitButton,
  VBars,
} from "./dashboard-client";

// ── HBars — horizontal bar chart ──
function HBars({
  rows,
}: {
  rows: { label: string; v: number; tone: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "var(--ink-muted)", fontWeight: 600 }}>
              {r.label}
            </span>
            <span
              className="mono"
              style={{ color: "var(--ink-subtle)", fontWeight: 700 }}
            >
              US$ {r.v}k
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 99,
              background: "var(--surface-3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(r.v / max) * 100}%`,
                height: "100%",
                borderRadius: 99,
                background: `var(--${r.tone})`,
                boxShadow: `0 0 10px rgba(var(--${r.tone}-rgb),.5)`,
                transition: "width .7s cubic-bezier(.2,.8,.3,1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── epic WSJF priority tone — mirrors kanban.tsx's epicPriority thresholds ──
function wsjfTone(wsjf: number): Tone {
  if (wsjf >= 18) {
    return "red";
  }
  return wsjf >= 13 ? "amber" : "green";
}

const THEME_ALLOC_TONES = ["accent", "blue", "purple", "green", "amber"];

function formatCostK(usd: number): string {
  return (usd / 1000).toFixed(1).replace(".", ",");
}

export default async function DashboardScreen(_props?: { param?: string }) {
  const [
    epicsResult,
    sprintsResult,
    predictabilityResult,
    budgetsResult,
    cloudCostResult,
    piHeaderResult,
    artCountResult,
  ] = await Promise.all([
    listEpics(),
    listRecentSprints(),
    listRecentPiPredictability(),
    listLeanBudgets(),
    getCloudCostSummary(),
    getActivePiPlanning(),
    getActiveArtCount(),
  ]);

  const epics = epicsResult.ok ? epicsResult.data : [];
  const inProgress = epics.filter((e) => e.column === "implementing");

  // ── Velocity — SP delivered per closed sprint, oldest→newest ──
  const closedSprints = (sprintsResult.ok ? sprintsResult.data : []).filter(
    (s) => s.velocity !== null
  );
  const recentSprints = closedSprints.slice(0, 6).reverse();
  const velocity = recentSprints.map((s) => s.velocity ?? 0);
  const velocityLabels = recentSprints.map((s) => s.name);
  const latestSprint = closedSprints[0];
  const prevSprint = closedSprints[1];
  const latestSprintVelocity = latestSprint?.velocity ?? null;
  const prevSprintVelocity = prevSprint?.velocity ?? null;
  const throughputDeltaPct =
    latestSprintVelocity !== null &&
    prevSprintVelocity !== null &&
    prevSprintVelocity > 0
      ? Math.round(
          ((latestSprintVelocity - prevSprintVelocity) / prevSprintVelocity) *
            100
        )
      : null;

  // ── Predictability — PIPlan.ppm per closed PI, oldest→newest ──
  const predict = predictabilityResult.ok ? predictabilityResult.data : [];
  const latestPi = predict.at(-1);
  const prevPi = predict.length >= 2 ? predict.at(-2) : undefined;
  const predictabilityDelta =
    latestPi && prevPi ? latestPi.ppmPct - prevPi.ppmPct : null;

  // ── Theme allocation — committed Lean Budget amount, grouped by theme ──
  const budgets = budgetsResult.ok ? budgetsResult.data : [];
  const themeTotals = new Map<string, number>();
  for (const b of budgets) {
    if (!b.themeName) {
      continue;
    }
    themeTotals.set(
      b.themeName,
      (themeTotals.get(b.themeName) ?? 0) + b.amount
    );
  }
  const themeAlloc = [...themeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount], i) => ({
      label,
      v: Math.round(amount / 1000),
      tone: THEME_ALLOC_TONES[i % THEME_ALLOC_TONES.length],
    }));

  // ── Cloud cost — CostSnapshot/CostAnomaly, current calendar month ──
  const cloudCost = cloudCostResult.ok ? cloudCostResult.data : null;
  const openAnomalyCount = cloudCost?.openAnomalyCount ?? 0;
  const cloudCostUsd = cloudCost?.currentMonthCostUsd ?? null;
  const cloudCostDeltaPct = cloudCost?.deltaPct ?? null;

  // ── Header badges — active PIPlan/Sprint and running-ART count ──
  const piHeader = piHeaderResult.ok ? piHeaderResult.data : null;
  const artCount = artCountResult.ok ? artCountResult.data : 0;
  const artCountLabel =
    artCount === 1 ? "1 ART ativo" : `${artCount} ARTs ativos`;
  const artCountHint = artCount === 1 ? "1 ART" : `${artCount} ARTs`;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Resumo executivo"
        meta={
          <>
            {piHeader ? (
              <Badge dot pulse tone="green">
                {piHeader.activeSprintName
                  ? `${piHeader.piPlanName} · ${piHeader.activeSprintName}`
                  : piHeader.piPlanName}
              </Badge>
            ) : (
              <Badge tone="neutral">Sem PI ativo</Badge>
            )}
            <Badge tone="neutral">{artCountLabel}</Badge>
          </>
        }
        subtitle="Saúde do portfólio SAFe em um olhar — predictability, throughput, custo e épicos em execução ao longo dos ARTs."
        title="Visão Geral"
      >
        <OrbitButton />
      </PageHeader>

      <AnomaliesCopilotBar>
        <strong style={{ color: "var(--accent-text)", fontWeight: 700 }}>
          ORBIT
        </strong>{" "}
        ·{" "}
        {openAnomalyCount > 0 ? (
          <>
            custo de nuvem
            {cloudCostDeltaPct !== null
              ? ` ${cloudCostDeltaPct >= 0 ? "subiu" : "caiu"} ${Math.abs(cloudCostDeltaPct)}% no mês`
              : ""}{" "}
            com {openAnomalyCount}{" "}
            {openAnomalyCount === 1 ? "anomalia aberta" : "anomalias abertas"} —
            revise os guardrails de FinOps antes do próximo checkpoint.
          </>
        ) : (
          "nenhuma anomalia de custo em aberto no momento — guardrails de FinOps dentro do esperado."
        )}
      </AnomaliesCopilotBar>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          delta={
            predictabilityDelta !== null
              ? `${predictabilityDelta >= 0 ? "+" : ""}${predictabilityDelta} pts`
              : undefined
          }
          deltaTone={
            predictabilityDelta !== null && predictabilityDelta >= 0
              ? "green"
              : "red"
          }
          hint={prevPi ? `vs. ${prevPi.label}` : "PI mais recente encerrado"}
          icon="target"
          label="PI Predictability"
          tone={latestPi ? "green" : "neutral"}
          unit={latestPi ? "%" : undefined}
          value={latestPi ? latestPi.ppmPct : "—"}
        />
        <KpiCard
          hint={artCountHint}
          icon="layers"
          label="Épicos em progresso"
          tone="accent"
          value={String(inProgress.length)}
        />
        <KpiCard
          delta={
            throughputDeltaPct !== null
              ? `${throughputDeltaPct >= 0 ? "+" : ""}${throughputDeltaPct}%`
              : undefined
          }
          deltaTone={
            throughputDeltaPct !== null && throughputDeltaPct >= 0
              ? "green"
              : "amber"
          }
          hint={prevSprint ? `vs. ${prevSprint.name}` : "sem sprint anterior"}
          icon="activity"
          label="Throughput por Sprint"
          tone="blue"
          unit={latestSprintVelocity !== null ? "SP" : undefined}
          value={latestSprintVelocity !== null ? latestSprintVelocity : "—"}
        />
        <KpiCard
          delta={
            cloudCostDeltaPct !== null
              ? `${cloudCostDeltaPct >= 0 ? "+" : ""}${cloudCostDeltaPct}%`
              : undefined
          }
          deltaTone={
            cloudCostDeltaPct !== null && cloudCostDeltaPct > 0
              ? "amber"
              : "green"
          }
          hint={
            openAnomalyCount > 0
              ? `${openAnomalyCount} ${openAnomalyCount === 1 ? "anomalia" : "anomalias"}`
              : "sem anomalias"
          }
          icon="dollar"
          label="Custo de nuvem · MTD"
          tone={cloudCostUsd !== null ? "amber" : "neutral"}
          unit={cloudCostUsd !== null ? "k" : undefined}
          value={cloudCostUsd !== null ? formatCostK(cloudCostUsd) : "—"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SectionCard
          bodyStyle={{ overflow: "visible" }}
          icon="activity"
          subtitle="Story points entregues por sprint encerrado"
          title="Velocity do Programa"
          tone="accent"
        >
          {velocity.length >= 2 ? (
            <AreaChart data={velocity} labels={velocityLabels} tone="accent" />
          ) : (
            <EmptyState
              description="Histórico de sprints encerrados insuficiente para exibir a tendência de velocity."
              icon="activity"
              title="Sem dados de velocity"
            />
          )}
        </SectionCard>
        <SectionCard
          bodyStyle={{ overflow: "visible" }}
          icon="target"
          subtitle="Program Predictability Measure (PPM) por PI encerrado"
          title="Predictability por PI"
          tone="green"
        >
          {predict.length > 0 ? (
            <VBars
              data={predict.map((p) => ({ label: p.label, v: p.ppmPct }))}
            />
          ) : (
            <EmptyState
              description="Nenhum PI encerrado com PPM calculado ainda."
              icon="target"
              title="Sem dados de predictability"
            />
          )}
        </SectionCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
        }}
      >
        <SectionCard
          icon="compass"
          subtitle="Investimento comprometido (US$ k)"
          title="Alocação por Tema Estratégico"
          tone="purple"
        >
          {themeAlloc.length > 0 ? (
            <HBars rows={themeAlloc} />
          ) : (
            <EmptyState
              description="Nenhum Lean Budget com tema estratégico associado ainda."
              icon="compass"
              title="Sem alocação por tema"
            />
          )}
        </SectionCard>
        <SectionCard
          action={
            <NavButton
              iconRight="arrowRight"
              size="sm"
              to="kanban"
              variant="ghost"
            >
              Ver Kanban
            </NavButton>
          }
          icon="layers"
          subtitle={`${inProgress.length} em execução`}
          title="Épicos em Implementação"
          tone="blue"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {inProgress.map((e) => {
              const art = e.art ? ARTS[e.art] : undefined;
              const artTone = art?.tone ?? "accent";
              return (
                <EpicRow id={e.id} key={e.id}>
                  <CopyId value={e.id}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: `var(--${artTone}-text)`,
                        background: `rgba(var(--${artTone}-rgb),.14)`,
                        border: `1px solid rgba(var(--${artTone}-rgb),.28)`,
                        borderRadius: 5,
                        padding: "1px 6px",
                      }}
                    >
                      {e.id}
                    </span>
                  </CopyId>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <Badge
                      tone={wsjfTone(e.wsjf)}
                    >{`WSJF ${e.wsjf.toFixed(1)}`}</Badge>
                    {e.hot && (
                      <Badge icon="zap" tone="red">
                        Quente
                      </Badge>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.title}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <Progress height={5} tone={artTone} value={e.progress} />
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-subtle)",
                      flexShrink: 0,
                    }}
                  >
                    {e.progress}%
                  </span>
                </EpicRow>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
