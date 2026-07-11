"use client";

import {
  Clock,
  LayoutGrid,
  Layers3,
  Shuffle,
  Target,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge } from "@/app/(authenticated)/components/gauge";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type {
  FlowMetricsResult,
  FlowScopeOption,
} from "@/app/actions/flow-metrics";
import {
  createAssessment,
  createImprovementAction,
  updateActionStatus,
} from "@/app/actions/measure-grow";
import { COMPETENCIES } from "@/app/actions/measure-grow/constants";
import type {
  ActionStatusValue,
  CompetencyKey,
} from "@/app/actions/measure-grow/schema";
import type { AssessmentWithActions } from "@/app/actions/measure-grow/types";
import { AnomalySummaryPanel } from "./anomaly-summary-panel";
import { ReEvaluateModal } from "./re-evaluate-modal";
import { StalenessBadge, type StalenessState } from "./staleness-badge";

// ── Module-level constants ─────────────────────────────────────────────────────

/** Cosmos tone cycle for multi-series charts (Flow Time bars, Distribution donut). */
const DIST_COLORS = [
  "rgb(var(--green-rgb))",
  "rgb(var(--blue-rgb))",
  "rgb(var(--purple-rgb))",
  "rgb(var(--amber-rgb))",
  "rgb(var(--red-rgb))",
  "rgb(var(--accent-rgb))",
];

const STATUS_COLOR: Record<string, string> = {
  OPEN: "rgb(var(--amber-rgb))",
  IN_PROGRESS: "rgb(var(--accent-rgb))",
  DONE: "rgb(var(--green-rgb))",
  CANCELLED: "var(--ink-faint)",
};

const METRIC_LABELS: Record<string, string> = {
  flow_velocity: "Flow Velocity",
  flow_time: "Flow Time",
  flow_load: "Flow Load",
  flow_efficiency: "Flow Efficiency",
  flow_predictability: "Flow Predictability",
  flow_distribution: "Flow Distribution",
};

const DEBT_TYPE_RX = /debt|débito/i;

/** Watermark icon paths for KpiCard (viewBox 0 0 24 24, stroke-only). */
const KPI_ICON_PATH = {
  velocity: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  flow_time: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  flow_load:
    "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73zM3.3 7l8.7 5 8.7-5M12 22V12",
  efficiency:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  predictability:
    "M2 18h1.4c1.3 0 2.5-.6 3.2-1.7l.9-1.3c.7-1.1 1.9-1.7 3.2-1.7h3M2 6h1.4c1.3 0 2.5.6 3.2 1.7l3.6 5.6c.7 1.1 1.9 1.7 3.2 1.7h3M18 3l4 3-4 3M18 15l4 3-4 3",
  distribution: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
} as const;

// ── KPI tone helper ────────────────────────────────────────────────────────────

function kpiTone(
  value: number | undefined,
  inverse: boolean,
  threshold?: number
): "green" | "red" | "amber" {
  if (value === undefined || value === null) {
    return "amber";
  }
  if (!threshold) {
    return "amber";
  }
  const good = inverse ? value <= threshold : value >= threshold;
  return good ? "green" : "red";
}

function formatDelta(value: number): string {
  if (value === 0) {
    return "— estável";
  }
  return `${value > 0 ? "↑" : "↓"} ${Math.abs(value)}`;
}

// ── Section title (Measure & Grow) ────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div
        className="h-1 w-4 rounded-full"
        style={{ background: "rgb(var(--accent-rgb))" }}
      />
      <span className="font-mono text-[11px] font-extrabold uppercase tracking-[.06em] text-ink-muted">
        {children}
      </span>
    </div>
  );
}

// ── Pure helpers (module-level — no closure over component state) ─────────────

function chipStyle(
  activeId: string | undefined,
  id: string
): React.CSSProperties {
  const active = activeId === id;
  return {
    padding: "5px 11px",
    borderRadius: 99,
    cursor: "pointer",
    fontFamily: "inherit",
    border: active
      ? "1.5px solid rgb(var(--accent-rgb))"
      : "1.5px solid var(--hairline)",
    background: active ? "rgb(var(--accent-rgb))" : "var(--surface-2)",
    color: active ? "var(--accent-text)" : "var(--ink-muted)",
    fontSize: 11,
    fontWeight: 600,
    transition: "background .12s, border-color .12s, color .12s",
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  scopeOptions: FlowScopeOption[];
  selectedScope: { type: string; id: string } | null;
  metrics: FlowMetricsResult | null;
  assessments: AssessmentWithActions[];
  actions: {
    id: string;
    title: string;
    status: string;
    relatedMetric: string | null;
    dueDate: Date | null;
  }[];
  snapshotId?: string;
  staleness?: StalenessState;
};

function exportMetricsCSV(
  metrics: FlowMetricsResult,
  scope: { type: string; id: string } | null
) {
  const rows: string[][] = [
    ["Metric", "Value", "Unit"],
    [
      "Velocity",
      String(metrics.flowVelocity.at(-1)?.total ?? 0),
      "items/sprint",
    ],
    ["Flow Time", String(metrics.flowTime[0]?.avgDays ?? 0), "days"],
    ["Flow Load", String(metrics.flowLoad), "WIP items"],
    ["Efficiency", String(Math.round(metrics.flowEfficiency * 100)), "%"],
    [
      "Predictability",
      String(Math.round(metrics.flowPredictability * 100)),
      "%",
    ],
    ["Distribution", String(metrics.flowDistribution.length), "types"],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flow-metrics-${scope?.type ?? "all"}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FlowMetricsDashboard({
  scopeOptions,
  selectedScope,
  metrics,
  assessments,
  actions,
  snapshotId,
  staleness,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"flow" | "measure">("flow");
  const [reEvalOpen, setReEvalOpen] = useState(false);

  const [assessCompetency, setAssessCompetency] = useState(COMPETENCIES[0].id);
  const [assessScore, setAssessScore] = useState(3);
  const [assessNotes, setAssessNotes] = useState("");
  const [assessLoading, setAssessLoading] = useState(false);

  const [actionTitle, setActionTitle] = useState("");
  const [actionMetric, setActionMetric] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  function changeScope(type: string, id: string) {
    router.push(`/analytics/flow?scope=${type}&scopeId=${id}`);
  }

  async function submitAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScope) {
      return;
    }
    setAssessLoading(true);
    await createAssessment({
      scope: selectedScope.type,
      scopeId: selectedScope.id,
      competency: assessCompetency as never,
      score: assessScore,
      notes: assessNotes,
    });
    setAssessNotes("");
    setAssessLoading(false);
    router.refresh();
  }

  async function submitAction(e: React.FormEvent) {
    e.preventDefault();
    if (!(selectedScope && actionTitle.trim())) {
      return;
    }
    setActionLoading(true);
    await createImprovementAction({
      title: actionTitle,
      scope: selectedScope.type,
      scopeId: selectedScope.id,
      relatedMetric: actionMetric || undefined,
    });
    setActionTitle("");
    setActionMetric("");
    setActionLoading(false);
    router.refresh();
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────

  function buildAlerts() {
    if (!metrics) {
      return [];
    }
    const out: {
      tone: "warn" | "good";
      icon: string;
      title: string;
      desc: string;
      action: string;
    }[] = [];
    if (metrics.flowLoad > 15) {
      out.push({
        tone: "warn",
        icon: "⚠",
        title: `WIP acima do limite (${metrics.flowLoad} itens)`,
        desc: `${metrics.flowLoad} itens em paralelo vs. limite de 15. Risco de aumento no Flow Time.`,
        action: "Priorizar fechamento de itens",
      });
    }
    if (metrics.flowPredictability < 0.8) {
      const pct = Math.round(metrics.flowPredictability * 100);
      out.push({
        tone: "warn",
        icon: "⚠",
        title: `Predictability em risco (${pct}%)`,
        desc: "Revise capacidade vs. comprometimento e identifique dependências.",
        action:
          pct < 70
            ? "Reduzir escopo do próximo PI"
            : "Identificar impedimentos",
      });
    }
    if (out.length === 0) {
      out.push({
        tone: "good",
        icon: "✓",
        title: "Fluxo saudável",
        desc: "Predictability ≥80% e WIP dentro do limite recomendado.",
        action: "Continue monitorando tendências",
      });
    }
    return out;
  }

  // ── Insights ─────────────────────────────────────────────────────────────────

  function buildInsights() {
    if (!metrics) {
      return [];
    }
    const out: {
      tone: "good" | "warn" | "neutral";
      icon: string;
      title: string;
      desc: string;
      action: string;
    }[] = [];
    const predPct = Math.round(metrics.flowPredictability * 100);
    const effPct = Math.round(metrics.flowEfficiency * 100);
    if (predPct >= 80) {
      out.push({
        tone: "good",
        icon: "📈",
        title: `Predictability em ${predPct}%`,
        desc: "Meta de 80%+ atingida. Compromisso vs entrega dentro do esperado.",
        action: "Replicar práticas no próximo PI",
      });
    }
    if (metrics.flowLoad > 15) {
      out.push({
        tone: "warn",
        icon: "⚠",
        title: `WIP ${Math.round((metrics.flowLoad / 15 - 1) * 100)}% acima do limite`,
        desc: `${metrics.flowLoad} itens em paralelo vs. limite de 15.`,
        action: "Priorizar fechamento de itens",
      });
    }
    const debt = metrics.flowDistribution.find((d) =>
      DEBT_TYPE_RX.test(d.type)
    );
    if (debt && debt.pct > 15) {
      out.push({
        tone: "warn",
        icon: "💡",
        title: `Débito técnico em ${debt.pct}% do mix`,
        desc: "Acima do recomendado (15%). Pode impactar entrega de novas features.",
        action: "Avaliar trade-off no próximo PI",
      });
    }
    if (effPct < 60) {
      out.push({
        tone: "neutral",
        icon: "💡",
        title: `Eficiência em ${effPct}%`,
        desc: "Abaixo do ideal (>60%). Investigue filas de espera e handoffs.",
        action: "Mapear gargalos no fluxo",
      });
    }
    return out.slice(0, 3);
  }

  // ── Scope filter bar ─────────────────────────────────────────────────────────

  const arts = scopeOptions.filter((o) => o.type === "art");
  const teams = scopeOptions.filter((o) => o.type === "team");

  const activeId = selectedScope?.id;

  const filterBar = (
    <div
      className="flex flex-wrap items-center gap-[18px] border-hairline border-b bg-surface-2"
      style={{ marginLeft: -24, marginRight: -24, marginTop: -24, padding: "12px 24px" }}
    >
      {arts.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-extrabold uppercase tracking-[.09em] text-ink-muted">
            ART
          </span>
          <div className="flex flex-wrap gap-1.5">
            {arts.map((a) => (
              <button
                aria-pressed={activeId === a.id}
                key={a.id}
                onClick={() => changeScope(a.type, a.id)}
                style={chipStyle(activeId, a.id)}
                type="button"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {arts.length > 0 && teams.length > 0 && (
        <div className="h-[22px] w-px bg-hairline" />
      )}
      {teams.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-extrabold uppercase tracking-[.09em] text-ink-muted">
            Time
          </span>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <button
                aria-pressed={activeId === t.id}
                key={t.id}
                onClick={() => changeScope(t.type, t.id)}
                style={chipStyle(activeId, t.id)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {scopeOptions.length === 0 && (
        <span className="text-[12px] text-ink-muted">
          Nenhum escopo disponível
        </span>
      )}
      {!!metrics && (
        <button
          className="ml-auto flex items-center gap-1.5 rounded-cosmos-pill border border-hairline-strong bg-surface px-3.5 py-[7px] font-semibold text-[12px] text-ink transition-colors hover:bg-surface-3"
          onClick={() => exportMetricsCSV(metrics, selectedScope)}
          type="button"
        >
          ↓ Export CSV
        </button>
      )}
    </div>
  );

  const tabBar = (
    <div
      className="flex gap-[22px] border-hairline border-b bg-surface-2"
      style={{ marginLeft: -24, marginRight: -24, padding: "0 24px" }}
    >
      {(["flow", "measure"] as const).map((tab) => (
        <button
          className="border-transparent border-b-[2.5px] py-[11px] font-bold text-[13px] transition-colors"
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            borderBottomColor:
              activeTab === tab ? "rgb(var(--accent-rgb))" : "transparent",
            color: activeTab === tab ? "var(--ink)" : "var(--ink-faint)",
          }}
          type="button"
        >
          {tab === "flow" ? "Flow Metrics" : "Measure & Grow"}
        </button>
      ))}
    </div>
  );

  if (!metrics) {
    return (
      <div>
        {filterBar}
        {tabBar}
        <div className="mt-6 flex h-40 items-center justify-center text-[14px] text-ink-muted">
          Selecione um escopo para ver as métricas.
        </div>
      </div>
    );
  }

  const alerts = buildAlerts();
  const insights = buildInsights();

  const velocityLast = metrics.flowVelocity.at(-1)?.total;
  const velocityPrev = metrics.flowVelocity.at(-2)?.total ?? velocityLast;
  const velocityDelta =
    velocityLast !== undefined && velocityPrev !== undefined
      ? velocityLast - velocityPrev
      : 0;
  const flowTimeDays = metrics.flowTimeOverall;
  const flowLoad = metrics.flowLoad;
  const effPct = Math.round(metrics.flowEfficiency * 100);
  const predPct = Math.round(metrics.flowPredictability * 100);
  const predSpark = metrics.flowPredictabilityHistory.map((d) =>
    d.planned > 0 ? Math.round((d.delivered / d.planned) * 100) : 0
  );
  const predPrev = predSpark.at(-2) ?? predPct;
  const predDelta = predPct - predPrev;
  const debtType = metrics.flowDistribution.find((d) =>
    DEBT_TYPE_RX.test(d.type)
  );

  return (
    <div>
      {filterBar}
      {tabBar}

      {/* ── FLOW METRICS ──────────────────────────────────────────────────────── */}
      {activeTab === "flow" && (
        <div className="mt-6 flex flex-col gap-5">
          {/* Alert banners */}
          <div className="flex flex-col gap-2">
            {alerts.map((a) => {
              const rgb = a.tone === "warn" ? "var(--amber-rgb)" : "var(--green-rgb)";
              const titleColor =
                a.tone === "warn" ? "var(--amber-text)" : "var(--green-text)";
              return (
                <div
                  className="flex items-start gap-2.5 rounded-cosmos-md border px-3.5 py-2.5"
                  key={a.title}
                  style={{
                    background: `rgba(${rgb},.10)`,
                    borderColor: `rgba(${rgb},.30)`,
                  }}
                >
                  <span className="text-[16px] leading-tight">{a.icon}</span>
                  <div className="flex-1">
                    <div
                      className="text-[12px] font-bold"
                      style={{ color: titleColor }}
                    >
                      {a.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-muted">
                      {a.desc}
                    </div>
                  </div>
                  <div
                    className="whitespace-nowrap text-[11px] font-semibold"
                    style={{ color: titleColor }}
                  >
                    {a.action} →
                  </div>
                </div>
              );
            })}
          </div>

          {/* Staleness banner + re-evaluate modal */}
          {!!staleness && !!snapshotId && (
            <>
              <div
                className="flex items-center justify-between rounded-cosmos-md border px-4 py-2.5"
                style={
                  staleness === "FRESH"
                    ? { justifyContent: "flex-end", background: "transparent", border: "none", padding: 0 }
                    : {
                        background: "rgba(var(--amber-rgb),.10)",
                        borderColor: "rgba(var(--amber-rgb),.30)",
                      }
                }
              >
                <StalenessBadge
                  onReEvaluate={
                    staleness === "STALE" || staleness === "CRITICAL"
                      ? () => setReEvalOpen(true)
                      : undefined
                  }
                  state={staleness}
                />
                {staleness !== "FRESH" && (
                  <span className="text-[11px] text-[color:var(--amber-text)]">
                    Dados podem estar desatualizados — re-avalie para precisão.
                  </span>
                )}
              </div>
              <ReEvaluateModal
                onClose={() => setReEvalOpen(false)}
                open={reEvalOpen}
                snapshotId={snapshotId}
              />
            </>
          )}

          {/* KPI grid */}
          <KpiGrid cols={3}>
            <KpiCard
              badge={formatDelta(velocityDelta)}
              iconPath={KPI_ICON_PATH.velocity}
              label="Velocity"
              tone={kpiTone(velocityLast, false, 30)}
              unit="itens/sprint"
              value={velocityLast ?? "—"}
            />
            <KpiCard
              badge="— estável"
              iconPath={KPI_ICON_PATH.flow_time}
              label="Flow Time"
              tone={kpiTone(flowTimeDays, true, 14)}
              unit="dias end-to-end"
              value={flowTimeDays}
            />
            <KpiCard
              badge={flowLoad > 15 ? "⚠ acima do limite" : "— dentro do limite"}
              iconPath={KPI_ICON_PATH.flow_load}
              label="Flow Load"
              tone="amber"
              unit="itens em WIP"
              value={flowLoad}
            />
            <KpiCard
              badge="— estável"
              iconPath={KPI_ICON_PATH.efficiency}
              label="Efficiency"
              tone={kpiTone(effPct, false, 60)}
              unit="% tempo ativo"
              value={effPct}
            />
            <KpiCard
              badge={formatDelta(predDelta)}
              iconPath={KPI_ICON_PATH.predictability}
              label="Predictability"
              tone={kpiTone(predPct, false, 80)}
              unit="% entregue/planejado"
              value={predPct}
            />
            <KpiCard
              badge={metrics.flowDistribution
                .map((d) => `${d.type} ${d.pct}%`)
                .join(" · ")}
              iconPath={KPI_ICON_PATH.distribution}
              label="Distribution"
              tone="amber"
              unit="tipos balanceados"
              value={metrics.flowDistribution.length}
            />
          </KpiGrid>

          {/* Charts — fixed 2-column grid (no interactive master/detail) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={Zap} title="Flow Velocity" subtitle="Itens entregues por sprint">
              {metrics.flowVelocity.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <BarChart barSize={28} data={metrics.flowVelocity}>
                    <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline-strong)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                    />
                    <Bar dataKey="total" fill="rgb(var(--green-rgb))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Sem sprints concluídos." />
              )}
            </SectionCard>

            <SectionCard
              icon={LayoutGrid}
              title="Flow Distribution"
              subtitle="Mix de trabalho no período"
              actions={
                debtType && debtType.pct > 15 ? (
                  <span className="rounded-full bg-[rgba(var(--amber-rgb),.16)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--amber-text)]">
                    Débito acima da meta
                  </span>
                ) : undefined
              }
            >
              {metrics.flowDistribution.length > 0 ? (
                <div className="flex items-center gap-5">
                  <ResponsiveContainer height={180} width={180}>
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={metrics.flowDistribution}
                        dataKey="count"
                        innerRadius={50}
                        nameKey="type"
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {metrics.flowDistribution.map((d, i) => (
                          <Cell fill={DIST_COLORS[i % DIST_COLORS.length]} key={d.type} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--hairline-strong)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--ink)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2.5">
                    {metrics.flowDistribution.map((d, i) => (
                      <div className="flex items-center gap-2 text-[12px]" key={d.type}>
                        <div
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: DIST_COLORS[i % DIST_COLORS.length] }}
                        />
                        <span className="font-semibold text-ink">{d.type}</span>
                        <span className="text-ink-muted">
                          {d.count} ({d.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyChart text="Sem itens concluídos no período." />
              )}
              <div className="mt-3 border-hairline border-t pt-2.5 text-[10px] text-ink-muted">
                Recomendado: Feature 60% · Bug 10% · Débito 15% · Spike 15%
              </div>
            </SectionCard>

            <SectionCard icon={Clock} title="Flow Time" subtitle="Ciclo médio por tipo de item (dias)">
              {metrics.flowTime.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <BarChart barSize={20} data={metrics.flowTime} layout="vertical">
                    <CartesianGrid horizontal={false} stroke="var(--hairline)" strokeDasharray="3 3" />
                    <XAxis
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                      type="number"
                      unit="d"
                    />
                    <YAxis
                      axisLine={false}
                      dataKey="type"
                      tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                      tickLine={false}
                      type="category"
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline-strong)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                      formatter={(v: number) => [`${v}d`, "Média"]}
                    />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
                      {metrics.flowTime.map((entry, i) => (
                        <Cell fill={DIST_COLORS[i % DIST_COLORS.length]} key={entry.type} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Configure startedAt nos boards para calcular Flow Time real." />
              )}
            </SectionCard>

            <SectionCard
              icon={Layers3}
              title="Flow Load — WIP"
              subtitle="Itens em andamento por sprint"
            >
              {metrics.flowLoadHistory.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <LineChart data={metrics.flowLoadHistory}>
                    <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline-strong)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                    />
                    <Line
                      activeDot={{ r: 6 }}
                      dataKey="wip"
                      dot={{ r: 4, fill: "rgb(var(--amber-rgb))" }}
                      stroke="rgb(var(--amber-rgb))"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      data={metrics.flowLoadHistory.map((d) => ({ ...d, limit: 15 }))}
                      dataKey="limit"
                      dot={false}
                      stroke="rgba(var(--red-rgb),.5)"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Sem histórico de sprints." />
              )}
              <div className="mt-3 border-hairline border-t pt-2.5 text-[10px] text-ink-muted">
                Linha vermelha = limite recomendado (15)
              </div>
            </SectionCard>

            <SectionCard
              icon={Target}
              title="Flow Efficiency"
              subtitle="Tempo ativo vs tempo de espera no fluxo"
            >
              <div className="flex items-center gap-7 py-2">
                <Gauge
                  label="Eficiência de fluxo"
                  size={104}
                  sublabel="Meta: >60%"
                  tone={kpiTone(effPct, false, 60)}
                  value={effPct}
                />
                <div className="flex gap-4">
                  <div>
                    <div className="font-bold text-[10px] uppercase tracking-[.06em] text-ink-muted">
                      Ativo
                    </div>
                    <div className="mt-0.5 font-extrabold text-[18px] text-[color:var(--green-text)]">
                      {effPct}%
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-[10px] uppercase tracking-[.06em] text-ink-muted">
                      Espera
                    </div>
                    <div className="mt-0.5 font-extrabold text-[18px] text-ink-muted">
                      {100 - effPct}%
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={Shuffle}
              title="Flow Predictability"
              subtitle="Planejado vs entregue por sprint"
            >
              {metrics.flowPredictabilityHistory.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <BarChart
                    barCategoryGap="30%"
                    barGap={4}
                    data={metrics.flowPredictabilityHistory}
                  >
                    <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--hairline-strong)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--ink-faint)" }} />
                    <Bar
                      dataKey="planned"
                      fill="rgba(var(--accent-rgb),.3)"
                      name="Planejado"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="delivered"
                      fill="rgb(var(--accent-rgb))"
                      name="Entregue"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Sem histórico de sprints." />
              )}
            </SectionCard>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <SectionTitle>Insights automáticos</SectionTitle>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
              >
                {insights.map((ins) => {
                  const rgb =
                    ins.tone === "good"
                      ? "var(--green-rgb)"
                      : ins.tone === "warn"
                        ? "var(--amber-rgb)"
                        : "var(--blue-rgb)";
                  const titleColor =
                    ins.tone === "good"
                      ? "var(--green-text)"
                      : ins.tone === "warn"
                        ? "var(--amber-text)"
                        : "var(--blue-text)";
                  return (
                    <div
                      className="rounded-cosmos-lg border px-4 py-3.5"
                      key={ins.title}
                      style={{ background: `rgba(${rgb},.10)`, borderColor: `rgba(${rgb},.30)` }}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-[16px]">{ins.icon}</span>
                        <span className="text-[12px] font-bold" style={{ color: titleColor }}>
                          {ins.title}
                        </span>
                      </div>
                      <p className="mb-2 text-[11px] text-ink-muted">{ins.desc}</p>
                      <div className="text-[11px] font-semibold" style={{ color: titleColor }}>
                        → {ins.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Anomaly Summary Panel ─────────────────────────────────────── */}
          {snapshotId && (
            <div className="mt-2">
              <AnomalySummaryPanel snapshotId={snapshotId} />
            </div>
          )}
        </div>
      )}

      {/* ── MEASURE & GROW ────────────────────────────────────────────────────── */}
      {activeTab === "measure" && selectedScope && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Competency scores */}
          <div className="flex flex-col gap-4">
            <SectionTitle>Competências SAFe — scores</SectionTitle>

            <div className="flex flex-col gap-3.5 rounded-cosmos-lg border border-hairline bg-surface p-4">
              {COMPETENCIES.map((c) => {
                const latest = assessments
                  .filter((a) => a.competency === c.id)
                  .sort(
                    (a, b) =>
                      new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime()
                  )[0];
                const score = latest?.score ?? null;
                let fillColor = "rgb(var(--accent-rgb))";
                if (score !== null) {
                  if (score >= 4) {
                    fillColor = "rgb(var(--green-rgb))";
                  } else if (score >= 3) {
                    fillColor = "rgb(var(--accent-rgb))";
                  } else {
                    fillColor = "rgb(var(--amber-rgb))";
                  }
                }
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-[12px] font-semibold text-ink">{c.label}</span>
                      <span
                        className="text-[12px] font-extrabold"
                        style={{ color: score ? fillColor : "var(--ink-faint)" }}
                      >
                        {score ? `${score}/5` : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ background: fillColor, width: score ? `${(score / 5) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assessment form */}
            <div className="rounded-cosmos-lg border border-hairline bg-surface p-4">
              <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-[.06em] text-ink-muted">
                Novo Assessment
              </div>
              <form className="flex flex-col gap-2.5" onSubmit={submitAssessment}>
                <select
                  aria-label="Competência"
                  className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink text-sm"
                  onChange={(e) => setAssessCompetency(e.target.value as CompetencyKey)}
                  value={assessCompetency}
                >
                  {COMPETENCIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2.5">
                  <span className="w-10 text-[11px] text-ink-muted">Score:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        aria-label={`Score ${n}`}
                        aria-pressed={assessScore >= n}
                        className="h-8 w-8 rounded-lg font-extrabold text-[13px] transition-colors"
                        key={n}
                        onClick={() => setAssessScore(n)}
                        style={{
                          background:
                            assessScore >= n ? "rgb(var(--accent-rgb))" : "var(--surface-3)",
                          color: assessScore >= n ? "var(--accent-text)" : "var(--ink-faint)",
                        }}
                        type="button"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  aria-label="Observações"
                  className="w-full resize-none rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink text-sm"
                  onChange={(e) => setAssessNotes(e.target.value)}
                  placeholder="Observações (opcional)"
                  rows={2}
                  value={assessNotes}
                />
                <button
                  className="rounded-lg py-2.5 font-bold text-[13px] transition-opacity"
                  disabled={assessLoading}
                  style={{
                    background: "rgb(var(--accent-rgb))",
                    color: "var(--accent-text)",
                    opacity: assessLoading ? 0.6 : 1,
                  }}
                  type="submit"
                >
                  {assessLoading ? "Salvando…" : "Registrar assessment"}
                </button>
              </form>
            </div>
          </div>

          {/* Improvement actions */}
          <div className="flex flex-col gap-4">
            <SectionTitle>Ações de Melhoria</SectionTitle>

            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {actions.length === 0 && (
                <div className="py-6 text-center text-[13px] text-ink-muted">
                  Nenhuma ação registrada.
                </div>
              )}
              {actions.map((action) => (
                <div
                  className="flex items-start gap-2.5 rounded-cosmos-md border border-hairline bg-surface px-3.5 py-2.5"
                  key={action.id}
                >
                  <div
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[action.status] ?? "var(--ink-faint)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-ink">{action.title}</div>
                    {action.relatedMetric && (
                      <div className="mt-0.5 text-[10px] text-ink-muted">
                        {METRIC_LABELS[action.relatedMetric] ?? action.relatedMetric}
                      </div>
                    )}
                  </div>
                  <select
                    aria-label="Status da ação"
                    className="rounded border border-hairline bg-surface-2 px-1 py-0.5 text-[10px] text-ink"
                    onChange={(e) => {
                      const val = e.target.value as ActionStatusValue;
                      startTransition(async () => {
                        await updateActionStatus(action.id, val);
                        router.refresh();
                      });
                    }}
                    value={action.status}
                  >
                    {["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* New action form */}
            <div className="rounded-cosmos-lg border border-hairline bg-surface p-4">
              <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-[.06em] text-ink-muted">
                Nova Ação
              </div>
              <form className="flex flex-col gap-2" onSubmit={submitAction}>
                <input
                  className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink text-sm"
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Título da ação"
                  required
                  type="text"
                  value={actionTitle}
                />
                <select
                  aria-label="Métrica relacionada"
                  className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink text-sm"
                  onChange={(e) => setActionMetric(e.target.value)}
                  value={actionMetric}
                >
                  <option value="">Métrica relacionada (opcional)</option>
                  {Object.entries(METRIC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-lg py-2.5 font-bold text-[13px] transition-opacity"
                  disabled={actionLoading || !actionTitle.trim()}
                  style={{
                    background: "rgb(var(--accent-rgb))",
                    color: "var(--accent-text)",
                    opacity: actionLoading || !actionTitle.trim() ? 0.5 : 1,
                  }}
                  type="submit"
                >
                  {actionLoading ? "Salvando…" : "Registrar ação"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state helper ────────────────────────────────────────────────────────

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-[13px] text-ink-muted">
      {text}
    </div>
  );
}
