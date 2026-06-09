"use client";

import { Clock, LayoutGrid, Package, Shuffle, Target, Zap } from "lucide-react";
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
import KpiCard from "@/app/(authenticated)/analytics/components/KpiCard";
import type {
  FlowMetricsResult,
  FlowScopeOption,
} from "@/app/actions/flow-metrics";
import type { AssessmentWithActions } from "@/app/actions/measure-grow";
import {
  type ActionStatusValue,
  type CompetencyKey,
  createAssessment,
  createImprovementAction,
  updateActionStatus,
} from "@/app/actions/measure-grow";
import { COMPETENCIES } from "@/app/actions/measure-grow/constants";
import { AnomalySummaryPanel } from "./anomaly-summary-panel";
import { ReEvaluateModal } from "./re-evaluate-modal";
import { StalenessBadge, type StalenessState } from "./staleness-badge";

// ── Module-level constants ─────────────────────────────────────────────────────
const DEBT_TYPE_RE = /debt|débito/i;

const KPI_CONFIG = [
  {
    key: "velocity",
    label: "Velocity",
    unit: "itens/sprint",
    color: "hsl(var(--chart-1))",
    icon: "Zap",
    inverse: false,
  },
  {
    key: "flow_time",
    label: "Flow Time",
    unit: "dias end-to-end",
    color: "hsl(var(--chart-2))",
    icon: "Clock",
    inverse: true,
  },
  {
    key: "flow_load",
    label: "Flow Load",
    unit: "itens em WIP",
    color: "oklch(0.68 0.18 50)",
    icon: "Package",
    inverse: true,
  },
  {
    key: "efficiency",
    label: "Efficiency",
    unit: "% tempo ativo",
    color: "hsl(var(--success))",
    icon: "Target",
    inverse: false,
  },
  {
    key: "predictability",
    label: "Predictability",
    unit: "% entregue/planejado",
    color: "hsl(var(--primary))",
    icon: "Shuffle",
    inverse: false,
  },
  {
    key: "distribution",
    label: "Distribution",
    unit: "tipos balanceados",
    color: "hsl(var(--chart-5))",
    icon: "LayoutGrid",
    inverse: false,
  },
] as const;

type KpiKey = (typeof KPI_CONFIG)[number]["key"];

const DIST_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "oklch(0.68 0.18 220)",
  "oklch(0.72 0.18 30)",
];

const STATUS_COLOR: Record<string, string> = {
  OPEN: "oklch(0.68 0.18 50)",
  IN_PROGRESS: "hsl(var(--primary))",
  DONE: "hsl(var(--success))",
  CANCELLED: "hsl(var(--muted-foreground))",
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

// ── KPI icon renderer ──────────────────────────────────────────────────────────

function KpiIcon({ name, size = 14 }: { name: string; size?: number }) {
  const props = { size, strokeWidth: 2 };
  switch (name) {
    case "Zap":
      return <Zap {...props} />;
    case "Clock":
      return <Clock {...props} />;
    case "Package":
      return <Package {...props} />;
    case "Target":
      return <Target {...props} />;
    case "Shuffle":
      return <Shuffle {...props} />;
    case "LayoutGrid":
      return <LayoutGrid {...props} />;
    default:
      return null;
  }
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return null;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100,
    h = 26;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-label="Sparkline chart"
      height={h}
      role="img"
      style={{ overflow: "visible", display: "block" }}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
    >
      <title>Sparkline chart</title>
      <polyline
        fill="none"
        opacity=".9"
        points={pts}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function Delta({
  value,
  inverse = false,
}: {
  value: number;
  inverse?: boolean;
}) {
  if (value === 0) {
    return (
      <span
        style={{
          fontSize: 10,
          color: "hsl(var(--muted-foreground))",
          fontWeight: 600,
        }}
      >
        —
      </span>
    );
  }
  const good = inverse ? value < 0 : value > 0;
  const clr = good ? "hsl(var(--success))" : "hsl(var(--destructive))";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: clr,
        background: `color-mix(in srgb, ${clr} 12%, transparent)`,
        padding: "2px 5px",
        borderRadius: 4,
      }}
    >
      {value > 0 ? "↑" : "↓"} {Math.abs(value)}
    </span>
  );
}

// ── Chart card shell ──────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  badge,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "hsl(var(--card))",
        borderRadius: 14,
        border: "1px solid hsl(var(--border))",
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "hsl(var(--foreground))",
              letterSpacing: ".04em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          {!!subtitle && (
            <div
              style={{
                fontSize: 10,
                color: "hsl(var(--muted-foreground))",
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {badge}
      </div>
      {children}
      {!!footer && (
        <div
          style={{
            fontSize: 10,
            color: "hsl(var(--muted-foreground))",
            marginTop: 12,
            borderTop: "1px solid hsl(var(--border))",
            paddingTop: 10,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Section title (Measure & Grow) ────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          height: 4,
          width: 16,
          borderRadius: 4,
          background: "hsl(var(--primary))",
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "hsl(var(--muted-foreground))",
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
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
      ? "1.5px solid hsl(var(--primary))"
      : "1.5px solid hsl(var(--border))",
    background: active ? "hsl(var(--primary))" : "hsl(var(--card))",
    color: active
      ? "hsl(var(--primary-foreground))"
      : "hsl(var(--muted-foreground))",
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
  const [activeKpi, setActiveKpi] = useState<KpiKey>("velocity");
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

  // ── Derived KPI data ─────────────────────────────────────────────────────────

  function kpiData(key: KpiKey): {
    value: string;
    sub: string;
    delta: number;
    warn?: boolean;
    spark: number[];
  } {
    if (!metrics) {
      return { value: "—", sub: "", delta: 0, spark: [] };
    }
    switch (key) {
      case "velocity": {
        const last = metrics.flowVelocity.at(-1)?.total ?? 0;
        const prev = metrics.flowVelocity.at(-2)?.total ?? last;
        return {
          value: String(last),
          sub: "Média últimas 3 sprints",
          delta: last - prev,
          spark: metrics.flowVelocity.map((d) => d.total),
        };
      }
      case "flow_time":
        return {
          value: String(metrics.flowTimeOverall),
          sub: "P50 ciclo de entrega",
          delta: 0,
          spark: [],
        };
      case "flow_load": {
        const wip = metrics.flowLoad;
        return {
          value: String(wip),
          sub: "Limite WIP recomendado: 15",
          delta: 0,
          warn: wip > 15,
          spark: metrics.flowLoadHistory.map((d) => d.wip),
        };
      }
      case "efficiency": {
        const pct = Math.round(metrics.flowEfficiency * 100);
        return {
          value: String(pct),
          sub: "Tempo em fluxo vs espera",
          delta: 0,
          warn: pct < 30,
          spark: [],
        };
      }
      case "predictability": {
        const pct = Math.round(metrics.flowPredictability * 100);
        const spark = metrics.flowPredictabilityHistory.map((d) =>
          d.planned > 0 ? Math.round((d.delivered / d.planned) * 100) : 0
        );
        const prev = spark.at(-2) ?? pct;
        return {
          value: String(pct),
          sub: "Compromisso vs entrega",
          delta: pct - prev,
          spark,
        };
      }
      case "distribution":
        return {
          value: String(metrics.flowDistribution.length),
          sub: metrics.flowDistribution
            .map((d) => `${d.type} ${d.pct}%`)
            .join(" · "),
          delta: 0,
          spark: [],
        };
      default: {
        const _exhaustive: never = key;
        return { value: "—", sub: "", delta: 0, spark: [] };
      }
    }
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
      style={{
        marginLeft: -24,
        marginRight: -24,
        marginTop: -24,
        padding: "12px 24px",
        background: "hsl(var(--card))",
        borderBottom: "1px solid hsl(var(--border))",
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      {arts.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "hsl(var(--muted-foreground))",
              letterSpacing: ".09em",
              textTransform: "uppercase",
            }}
          >
            ART
          </span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
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
        <div
          style={{
            width: 1,
            height: 22,
            background: "hsl(var(--border))",
          }}
        />
      )}
      {teams.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "hsl(var(--muted-foreground))",
              letterSpacing: ".09em",
              textTransform: "uppercase",
            }}
          >
            Time
          </span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
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
        <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          Nenhum escopo disponível
        </span>
      )}
      {!!metrics && (
        <button
          onClick={() => exportMetricsCSV(metrics, selectedScope)}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            background: "hsl(var(--muted))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "hsl(var(--foreground))",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          type="button"
        >
          ↓ Export CSV
        </button>
      )}
    </div>
  );

  const tabBar = (
    <div
      style={{
        marginLeft: -24,
        marginRight: -24,
        padding: "0 24px",
        background: "hsl(var(--card))",
        borderBottom: "1px solid hsl(var(--border))",
        display: "flex",
        gap: 22,
      }}
    >
      {(["flow", "measure"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            padding: "11px 0",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: `2.5px solid ${activeTab === tab ? "hsl(var(--primary))" : "transparent"}`,
            color:
              activeTab === tab
                ? "hsl(var(--foreground))"
                : "hsl(var(--muted-foreground))",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            transition: "color .15s",
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
        <div
          style={{
            height: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "hsl(var(--muted-foreground))",
            fontSize: 14,
            marginTop: 24,
          }}
        >
          Selecione um escopo para ver as métricas.
        </div>
      </div>
    );
  }

  const alerts = buildAlerts();
  const insights = buildInsights();

  return (
    <div>
      {filterBar}
      {tabBar}

      {/* ── FLOW METRICS ──────────────────────────────────────────────────────── */}
      {activeTab === "flow" && (
        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Alert banners */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => {
              const s =
                a.tone === "warn"
                  ? {
                      bg: "color-mix(in srgb, oklch(0.68 0.18 50) 10%, hsl(var(--card)))",
                      border:
                        "color-mix(in srgb, oklch(0.68 0.18 50) 30%, transparent)",
                      title: "oklch(0.55 0.15 50)",
                      desc: "oklch(0.45 0.12 50)",
                    }
                  : {
                      bg: "color-mix(in srgb, hsl(var(--success)) 10%, hsl(var(--card)))",
                      border:
                        "color-mix(in srgb, hsl(var(--success)) 30%, transparent)",
                      title: "hsl(var(--success))",
                      desc: "color-mix(in srgb, hsl(var(--success)) 80%, hsl(var(--foreground)))",
                    };
              return (
                <div
                  key={a.title}
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1.3 }}>
                    {a.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontSize: 12, fontWeight: 700, color: s.title }}
                    >
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: s.desc, marginTop: 2 }}>
                      {a.desc}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: s.title,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.action} →
                  </div>
                </div>
              );
            })}
          </div>

          {/* Staleness badge + re-evaluate modal */}
          {staleness && snapshotId && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <StalenessBadge
                  onReEvaluate={
                    staleness === "STALE" || staleness === "CRITICAL"
                      ? () => setReEvalOpen(true)
                      : undefined
                  }
                  state={staleness}
                />
              </div>
              <ReEvaluateModal
                onClose={() => setReEvalOpen(false)}
                open={reEvalOpen}
                snapshotId={snapshotId}
              />
            </>
          )}

          {/* KPI grid */}
          <div className="flex flex-wrap gap-4 rounded-[18px] bg-[#070b14] p-6">
            {(() => {
              const velocityLast = metrics.flowVelocity.at(-1)?.total;
              const velocityPrev =
                metrics.flowVelocity.at(-2)?.total ?? velocityLast;
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

              return (
                <>
                  <KpiCard
                    badge={<Delta inverse={false} value={velocityDelta} />}
                    icon="activity"
                    label="Velocity"
                    tone={kpiTone(velocityLast, false, 30)}
                    unit="itens/sprint"
                    value={String(velocityLast ?? "—")}
                  />
                  <KpiCard
                    badge={<Delta inverse={true} value={0} />}
                    icon="clock"
                    label="Flow Time"
                    tone={kpiTone(flowTimeDays, true, 14)}
                    unit="dias end-to-end"
                    value={String(flowTimeDays)}
                  />
                  <KpiCard
                    badge={
                      flowLoad > 15 ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-[10px] text-amber-400">
                          acima do limite
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          WIP
                        </span>
                      )
                    }
                    icon="activity"
                    label="Flow Load"
                    tone="amber"
                    unit="itens em WIP"
                    value={String(flowLoad)}
                  />
                  <KpiCard
                    badge={<Delta inverse={false} value={0} />}
                    icon="check"
                    label="Efficiency"
                    tone={kpiTone(effPct, false, 60)}
                    unit="% tempo ativo"
                    value={String(effPct)}
                  />
                  <KpiCard
                    badge={<Delta inverse={false} value={predDelta} />}
                    icon="check"
                    label="Predictability"
                    tone={kpiTone(predPct, false, 80)}
                    unit="% entregue/planejado"
                    value={String(predPct)}
                  />
                  <KpiCard
                    badge={
                      <span className="text-[10px] text-muted-foreground">
                        {metrics.flowDistribution
                          .map((d) => `${d.type} ${d.pct}%`)
                          .join(" · ")}
                      </span>
                    }
                    icon="activity"
                    label="Distribution"
                    tone="amber"
                    unit="tipos balanceados"
                    value={String(metrics.flowDistribution.length)}
                  />
                </>
              );
            })()}
          </div>

          {/* ── Staleness banner ─────────────────────────────────────── */}
          {!!staleness && staleness !== "FRESH" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background:
                  "color-mix(in srgb, oklch(0.68 0.18 50) 10%, hsl(var(--card)))",
                border:
                  "1px solid color-mix(in srgb, oklch(0.68 0.18 50) 30%, transparent)",
                borderRadius: 10,
                padding: "10px 16px",
              }}
            >
              <StalenessBadge
                onReEvaluate={
                  staleness === "STALE" || staleness === "CRITICAL"
                    ? () => setReEvalOpen(true)
                    : undefined
                }
                state={staleness}
              />
              <span style={{ fontSize: 11, color: "oklch(0.55 0.15 50)" }}>
                Dados podem estar desatualizados — re-avalie para precisão.
              </span>
            </div>
          )}

          {/* ── Sub-sections: metric preview cards ────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div
              onClick={() => setActiveKpi("velocity")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveKpi("velocity");
                }
              }}
              role="button"
              style={{
                background: "hsl(var(--card))",
                borderRadius: 10,
                border: `1px solid ${activeKpi === "velocity" ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                padding: "14px 16px",
                cursor: "pointer",
              }}
              tabIndex={0}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "hsl(var(--foreground))",
                  marginBottom: 8,
                }}
              >
                Velocity
              </div>
              <Sparkline
                color="hsl(var(--chart-1))"
                data={metrics.flowVelocity.map((v) => v.total)}
              />
              <button
                style={{
                  fontSize: 10,
                  color: "hsl(var(--primary))",
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
                type="button"
              >
                Ver tudo →
              </button>
            </div>

            <div
              onClick={() => setActiveKpi("flow_time")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveKpi("flow_time");
                }
              }}
              role="button"
              style={{
                background: "hsl(var(--card))",
                borderRadius: 10,
                border: `1px solid ${activeKpi === "flow_time" ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                padding: "14px 16px",
                cursor: "pointer",
              }}
              tabIndex={0}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "hsl(var(--foreground))",
                  marginBottom: 8,
                }}
              >
                Flow Time
              </div>
              <Sparkline
                color="hsl(var(--chart-2))"
                data={metrics.flowTime.map((v) => v.avgDays)}
              />
              <button
                style={{
                  fontSize: 10,
                  color: "hsl(var(--primary))",
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
                type="button"
              >
                Ver tudo →
              </button>
            </div>

            <div
              onClick={() => setActiveKpi("efficiency")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveKpi("efficiency");
                }
              }}
              role="button"
              style={{
                background: "hsl(var(--card))",
                borderRadius: 10,
                border: `1px solid ${activeKpi === "efficiency" ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                padding: "14px 16px",
                cursor: "pointer",
              }}
              tabIndex={0}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "hsl(var(--foreground))",
                  marginBottom: 8,
                }}
              >
                Efficiency
              </div>
              <Sparkline
                color="hsl(var(--success))"
                data={(metrics.flowLoadHistory ?? []).map((v) => v.wip)}
              />
              <button
                style={{
                  fontSize: 10,
                  color: "hsl(var(--primary))",
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
                type="button"
              >
                Ver tudo →
              </button>
            </div>
          </div>

          {/* Detail chart — driven by active KPI */}
          {activeKpi === "velocity" && (
            <ChartCard
              footer="Meta: 45 itens/sprint"
              subtitle="Itens entregues por sprint"
              title="Flow Velocity"
            >
              {metrics.flowVelocity.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <BarChart barSize={28} data={metrics.flowVelocity}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="total"
                      fill="hsl(var(--chart-1))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Sem sprints concluídos." />
              )}
            </ChartCard>
          )}

          {activeKpi === "flow_time" && (
            <ChartCard
              subtitle="Ciclo médio por tipo de item (dias)"
              title="Flow Time"
            >
              {metrics.flowTime.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <BarChart
                    barSize={20}
                    data={metrics.flowTime}
                    layout="vertical"
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      axisLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      type="number"
                      unit="d"
                    />
                    <YAxis
                      axisLine={false}
                      dataKey="type"
                      tick={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      type="category"
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}d`, "Média"]}
                    />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
                      {metrics.flowTime.map((entry, i) => (
                        <Cell
                          fill={DIST_COLORS[i % DIST_COLORS.length]}
                          key={entry.type}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Configure startedAt nos boards para calcular Flow Time real." />
              )}
            </ChartCard>
          )}

          {activeKpi === "flow_load" && (
            <ChartCard
              footer="Linha vermelha = limite recomendado (15)"
              subtitle="Itens em andamento por sprint"
              title="Flow Load — WIP"
            >
              {metrics.flowLoadHistory.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <LineChart data={metrics.flowLoadHistory}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      activeDot={{ r: 6 }}
                      dataKey="wip"
                      dot={{ r: 4, fill: "oklch(0.68 0.18 50)" }}
                      stroke="oklch(0.68 0.18 50)"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      data={metrics.flowLoadHistory.map((d) => ({
                        ...d,
                        limit: 15,
                      }))}
                      dataKey="limit"
                      dot={false}
                      stroke="color-mix(in srgb, hsl(var(--destructive)) 38%, transparent)"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Sem histórico de sprints." />
              )}
            </ChartCard>
          )}

          {activeKpi === "efficiency" && (
            <ChartCard
              subtitle="Tempo ativo vs tempo de espera no fluxo"
              title="Flow Efficiency"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  padding: "16px 0",
                }}
              >
                <svg
                  style={{ width: 120, height: 120, flexShrink: 0 }}
                  viewBox="0 0 120 120"
                >
                  <title>Flow Efficiency</title>
                  <circle
                    cx="60"
                    cy="60"
                    fill="none"
                    r="50"
                    stroke="hsl(var(--border))"
                    strokeWidth="12"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    fill="none"
                    r="50"
                    stroke="hsl(var(--success))"
                    strokeDasharray={`${2 * Math.PI * 50 * metrics.flowEfficiency} ${2 * Math.PI * 50 * (1 - metrics.flowEfficiency)}`}
                    strokeLinecap="round"
                    strokeWidth="12"
                    transform="rotate(-90 60 60)"
                  />
                  <text
                    fill="hsl(var(--foreground))"
                    fontSize="22"
                    fontWeight="800"
                    textAnchor="middle"
                    x="60"
                    y="55"
                  >
                    {Math.round(metrics.flowEfficiency * 100)}
                  </text>
                  <text
                    fill="hsl(var(--muted-foreground))"
                    fontSize="10"
                    textAnchor="middle"
                    x="60"
                    y="72"
                  >
                    %
                  </text>
                </svg>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "hsl(var(--foreground))",
                      marginBottom: 4,
                    }}
                  >
                    Tempo ativo / tempo total
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Meta: &gt;60% de eficiência
                  </div>
                  <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "hsl(var(--muted-foreground))",
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontWeight: 700,
                        }}
                      >
                        Ativo
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "hsl(var(--success))",
                          marginTop: 2,
                        }}
                      >
                        {Math.round(metrics.flowEfficiency * 100)}%
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "hsl(var(--muted-foreground))",
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontWeight: 700,
                        }}
                      >
                        Espera
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "hsl(var(--muted-foreground))",
                          marginTop: 2,
                        }}
                      >
                        {100 - Math.round(metrics.flowEfficiency * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ChartCard>
          )}

          {activeKpi === "predictability" && (
            <ChartCard
              subtitle="Planejado vs entregue por sprint"
              title="Flow Predictability"
            >
              {metrics.flowPredictabilityHistory.length > 0 ? (
                <ResponsiveContainer height={200} width="100%">
                  <BarChart
                    barCategoryGap="30%"
                    barGap={4}
                    data={metrics.flowPredictabilityHistory}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        color: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <Bar
                      dataKey="planned"
                      fill="color-mix(in srgb, hsl(var(--primary)) 35%, hsl(var(--card)))"
                      name="Planejado"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="delivered"
                      fill="hsl(var(--primary))"
                      name="Entregue"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart text="Sem histórico de sprints." />
              )}
            </ChartCard>
          )}

          {activeKpi === "distribution" &&
            (() => {
              const debt = metrics.flowDistribution.find((d) =>
                DEBT_TYPE_RE.test(d.type)
              );
              return (
                <ChartCard
                  badge={
                    debt && debt.pct > 15 ? (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 5,
                          background:
                            "color-mix(in srgb, oklch(0.68 0.18 50) 15%, hsl(var(--card)))",
                          color: "oklch(0.55 0.15 50)",
                          fontWeight: 700,
                          fontSize: 10,
                        }}
                      >
                        Débito acima da meta
                      </span>
                    ) : undefined
                  }
                  footer="Recomendado: Feature 60% · Bug 10% · Débito 15% · Spike 15%"
                  subtitle="Mix de trabalho no período"
                  title="Flow Distribution"
                >
                  {metrics.flowDistribution.length > 0 ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 20 }}
                    >
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
                              <Cell
                                fill={DIST_COLORS[i % DIST_COLORS.length]}
                                key={d.type}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {metrics.flowDistribution.map((d, i) => (
                          <div
                            key={d.type}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                            }}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                background: DIST_COLORS[i % DIST_COLORS.length],
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontWeight: 600,
                                color: "hsl(var(--foreground))",
                              }}
                            >
                              {d.type}
                            </span>
                            <span
                              style={{
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              {d.count} ({d.pct}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyChart text="Sem itens concluídos no período." />
                  )}
                </ChartCard>
              );
            })()}

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <SectionTitle>Insights automáticos</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {insights.map((ins) => {
                  let s = {
                    bg: "color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card)))",
                    border:
                      "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)",
                    title: "hsl(var(--primary))",
                    desc: "color-mix(in srgb, hsl(var(--primary)) 80%, hsl(var(--foreground)))",
                  };
                  if (ins.tone === "good") {
                    s = {
                      bg: "color-mix(in srgb, hsl(var(--success)) 10%, hsl(var(--card)))",
                      border:
                        "color-mix(in srgb, hsl(var(--success)) 30%, transparent)",
                      title: "hsl(var(--success))",
                      desc: "color-mix(in srgb, hsl(var(--success)) 80%, hsl(var(--foreground)))",
                    };
                  } else if (ins.tone === "warn") {
                    s = {
                      bg: "color-mix(in srgb, oklch(0.68 0.18 50) 10%, hsl(var(--card)))",
                      border:
                        "color-mix(in srgb, oklch(0.68 0.18 50) 30%, transparent)",
                      title: "oklch(0.55 0.15 50)",
                      desc: "oklch(0.45 0.12 50)",
                    };
                  }
                  return (
                    <div
                      key={ins.title}
                      style={{
                        background: s.bg,
                        border: `1px solid ${s.border}`,
                        borderRadius: 12,
                        padding: "14px 16px",
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
                        <span style={{ fontSize: 16 }}>{ins.icon}</span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: s.title,
                          }}
                        >
                          {ins.title}
                        </span>
                      </div>
                      <p
                        style={{ fontSize: 11, color: s.desc, marginBottom: 8 }}
                      >
                        {ins.desc}
                      </p>
                      <div
                        style={{
                          fontSize: 11,
                          color: s.title,
                          fontWeight: 600,
                        }}
                      >
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
            <div className="mt-6">
              <AnomalySummaryPanel snapshotId={snapshotId} />
            </div>
          )}
        </div>
      )}

      {/* ── MEASURE & GROW ────────────────────────────────────────────────────── */}
      {activeTab === "measure" && selectedScope && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Competency scores */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionTitle>Competências SAFe — scores</SectionTitle>

            <div
              style={{
                background: "hsl(var(--card))",
                borderRadius: 14,
                border: "1px solid hsl(var(--border))",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {COMPETENCIES.map((c) => {
                const latest = assessments
                  .filter((a) => a.competency === c.id)
                  .sort(
                    (a, b) =>
                      new Date(b.assessedAt).getTime() -
                      new Date(a.assessedAt).getTime()
                  )[0];
                const score = latest?.score ?? null;
                let fillColor = "hsl(var(--primary))";
                if (score !== null) {
                  if (score >= 4) {
                    fillColor = "hsl(var(--success))";
                  } else if (score >= 3) {
                    fillColor = "hsl(var(--primary))";
                  } else {
                    fillColor = "oklch(0.68 0.18 50)";
                  }
                }
                return (
                  <div key={c.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {c.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: score
                            ? fillColor
                            : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {score ? `${score}/5` : "—"}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 99,
                        background: "hsl(var(--muted))",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 99,
                          background: fillColor,
                          width: score ? `${(score / 5) * 100}%` : "0%",
                          transition: "width .4s",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assessment form */}
            <div
              style={{
                background: "hsl(var(--card))",
                borderRadius: 14,
                border: "1px solid hsl(var(--border))",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "hsl(var(--muted-foreground))",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Novo Assessment
              </div>
              <form
                onSubmit={submitAssessment}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  onChange={(e) =>
                    setAssessCompetency(e.target.value as CompetencyKey)
                  }
                  value={assessCompetency}
                >
                  {COMPETENCIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: "hsl(var(--muted-foreground))",
                      width: 40,
                    }}
                  >
                    Score:
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        aria-label={`Score ${n}`}
                        aria-pressed={assessScore >= n}
                        key={n}
                        onClick={() => setAssessScore(n)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 13,
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          background:
                            assessScore >= n
                              ? "hsl(var(--primary))"
                              : "hsl(var(--muted))",
                          color:
                            assessScore >= n
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--muted-foreground))",
                          transition: "background .12s",
                        }}
                        type="button"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  onChange={(e) => setAssessNotes(e.target.value)}
                  placeholder="Observações (opcional)"
                  rows={2}
                  value={assessNotes}
                />
                <button
                  disabled={assessLoading}
                  style={{
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionTitle>Ações de Melhoria</SectionTitle>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {actions.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "hsl(var(--muted-foreground))",
                    fontSize: 13,
                    padding: "24px 0",
                  }}
                >
                  Nenhuma ação registrada.
                </div>
              )}
              {actions.map((action) => (
                <div
                  key={action.id}
                  style={{
                    background: "hsl(var(--card))",
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      marginTop: 4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      flexShrink: 0,
                      background:
                        STATUS_COLOR[action.status] ??
                        "hsl(var(--muted-foreground))",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      {action.title}
                    </div>
                    {action.relatedMetric && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "hsl(var(--muted-foreground))",
                          marginTop: 2,
                        }}
                      >
                        {METRIC_LABELS[action.relatedMetric] ??
                          action.relatedMetric}
                      </div>
                    )}
                  </div>
                  <select
                    className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
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
            <div
              style={{
                background: "hsl(var(--card))",
                borderRadius: 14,
                border: "1px solid hsl(var(--border))",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "hsl(var(--muted-foreground))",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Nova Ação
              </div>
              <form
                onSubmit={submitAction}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Título da ação"
                  required
                  type="text"
                  value={actionTitle}
                />
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
                  disabled={actionLoading || !actionTitle.trim()}
                  style={{
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
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
    <div
      style={{
        height: 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "hsl(var(--muted-foreground))",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
