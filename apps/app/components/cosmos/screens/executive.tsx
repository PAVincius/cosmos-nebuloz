"use client";

import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
// executive.tsx — Board Snapshot (design handoff screen-bundle-2.jsx:1163,
// ExecutiveScreen). Live executive summary assembled entirely from the
// existing mature analytics/list layers — no new aggregate queries beyond
// what's already tenant-scoped and reused here:
//   - getExecutiveDashboard() (lib/analytics/executive-dashboard.ts) for
//     ART health / predictability / flow KPIs
//   - listOkrs() for the strategic objectives list
//   - listRisks() for the top-risk feed (already ordered by severity desc)
//   - listLeanBudgets() for portfolio budget utilization
// Portfolio score is only computed from whichever of those sources actually
// has data — sources with zero rows are left out of the average rather than
// scored as 0, so an empty tenant never sees a fabricated "healthy" score.
//
// Export: browser print (window.print(), scoped print CSS below) + a CSV
// built directly from the same in-memory snapshot — no PDF dependency.
// Deferred (handoff-only, not built here): configurable sections /
// present-mode toggle.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type LeanBudgetView,
  listLeanBudgets,
} from "@/app/(cosmos)/actions/budgets";
import { listOkrs, type OkrView } from "@/app/(cosmos)/actions/okrs";
import { listRisks, type RiskView } from "@/app/(cosmos)/actions/risks";
import { getExecutiveDashboard } from "@/app/actions/analytics/executive";
import type {
  ARTRow,
  ExecutiveDashboardPayload,
} from "@/lib/analytics/executive-dashboard";
import { EmptyState } from "../empty-state";

const sectionLabelStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase" as const,
  color: "var(--ink-faint)",
  marginBottom: 8,
};

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #executive-print-root, #executive-print-root * { visibility: visible; }
  #executive-print-root { position: absolute; inset: 0; padding: 24px; }
  .no-print { display: none !important; }
}
`;

export type SnapshotState = {
  dashboard: ExecutiveDashboardPayload | null;
  okrs: OkrView[];
  risks: RiskView[];
  budgets: LeanBudgetView[];
};

const INITIAL_STATE: SnapshotState = {
  dashboard: null,
  okrs: [],
  risks: [],
  budgets: [],
};

function okrProgress(okr: OkrView): number {
  if (okr.keyResults.length === 0) {
    return 0;
  }
  return Math.round(
    okr.keyResults.reduce((s, kr) => s + kr.progressPct, 0) /
      okr.keyResults.length
  );
}

type ScoreComponent = { value: number };

function computeScoreComponents(state: SnapshotState): ScoreComponent[] {
  const components: ScoreComponent[] = [];

  if (state.okrs.length > 0) {
    const avg = Math.round(
      state.okrs.reduce((s, o) => s + okrProgress(o), 0) / state.okrs.length
    );
    components.push({ value: avg });
  }

  if (state.dashboard && state.dashboard.artTable.length > 0) {
    components.push({ value: state.dashboard.kpis.predictabilityPct });
  }

  const totalBudget = state.budgets.reduce((s, b) => s + b.amount, 0);
  if (state.budgets.length > 0 && totalBudget > 0) {
    const totalSpent = state.budgets.reduce((s, b) => s + b.spent, 0);
    components.push({
      value: Math.min(100, Math.round((totalSpent / totalBudget) * 100)),
    });
  }

  return components;
}

function csvEscape(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvSection(
  title: string,
  columns: string[],
  rows: (string | number | null)[][]
): string {
  const lines = [
    title,
    columns.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return lines.join("\n");
}

// Exported (not just used internally) so tests can assert the CSV body is
// built solely from the tenant-scoped snapshot passed in — no fabricated or
// placeholder rows — without needing a DOM/Blob environment.
export function buildSnapshotCsv(state: SnapshotState): string {
  const sections = [
    csvSection(
      "ARTs",
      ["ART", "Predictability %", "Anomalias críticas", "Saúde"],
      (state.dashboard?.artTable ?? []).map((a) => [
        a.artName,
        a.predictabilityPct,
        a.criticalAnomalies,
        a.health,
      ])
    ),
    csvSection(
      "OKRs",
      ["Objetivo", "Status", "Progresso %"],
      state.okrs.map((o) => [o.title, o.status, okrProgress(o)])
    ),
    csvSection(
      "Riscos",
      ["Título", "Severidade", "Categoria", "ROAM"],
      state.risks.map((r) => [r.title, r.severity, r.category, r.roamStatus])
    ),
    csvSection(
      "Budgets",
      ["Nome", "Valor", "Gasto", "Utilização %"],
      state.budgets.map((b) => [b.name, b.amount, b.spent, b.utilizationPct])
    ),
  ];
  return sections.join("\n\n");
}

function downloadSnapshotCsv(state: SnapshotState) {
  const csv = buildSnapshotCsv(state);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `board-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RingGauge({
  score,
  size = 120,
  stroke = 10,
}: {
  score: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const dash = pct * circ;
  const tone: Tone = score >= 80 ? "green" : score >= 60 ? "amber" : "red";
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg height={size} style={{ transform: "rotate(-90deg)" }} width={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke={`var(--${tone})`}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          strokeWidth={stroke}
          style={{
            filter: `drop-shadow(0 0 6px rgba(var(--${tone}-rgb),.6))`,
            transition: "stroke-dasharray .6s ease",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-.04em",
            lineHeight: 1,
            color: `var(--${tone}-text)`,
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".1em",
            color: "var(--ink-faint)",
            textTransform: "uppercase",
            marginTop: 1,
          }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}

const HEALTH_TONE: Record<string, Tone> = {
  HEALTHY: "green",
  WARNING: "amber",
  CRITICAL: "red",
};
const HEALTH_LABEL: Record<string, string> = {
  HEALTHY: "Saudável",
  WARNING: "Atenção",
  CRITICAL: "Crítico",
};

function ArtHealthMiniCard({ art }: { art: ARTRow }) {
  const tone = HEALTH_TONE[art.health] ?? "neutral";
  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: `var(--${tone})`,
            boxShadow: `0 0 6px var(--${tone})`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {art.artName}
        </span>
        <Badge tone={tone}>{HEALTH_LABEL[art.health] ?? art.health}</Badge>
      </div>
      <Progress height={6} tone={tone} value={art.predictabilityPct} />
      <div
        style={{
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--ink-faint)",
        }}
      >
        <span>Predictability</span>
        <span
          className="mono"
          style={{ fontWeight: 700, color: `var(--${tone}-text)` }}
        >
          {art.predictabilityPct}%
        </span>
      </div>
      {art.criticalAnomalies > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--red-text)" }}>
          {art.criticalAnomalies} anomalia(s) crítica(s)
        </div>
      )}
    </div>
  );
}

const OKR_STATUS_TONE: Record<string, Tone> = {
  ON_TRACK: "green",
  AT_RISK: "amber",
  BEHIND: "red",
  ACHIEVED: "blue",
};
const OKR_STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "On track",
  AT_RISK: "Em risco",
  BEHIND: "Atrasado",
  ACHIEVED: "Atingido",
};

function OkrSnapshotRow({ okr }: { okr: OkrView }) {
  const tone = OKR_STATUS_TONE[okr.status] ?? "neutral";
  const progress = okrProgress(okr);
  return (
    <div
      style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {okr.title}
        </span>
        <Badge dot tone={tone}>
          {OKR_STATUS_LABEL[okr.status] ?? okr.status}
        </Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Progress height={6} tone={tone} value={progress} />
        </div>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: `var(--${tone}-text)`,
            width: 36,
            textAlign: "right",
          }}
        >
          {progress}%
        </span>
      </div>
    </div>
  );
}

const RISK_ROAM_TONE: Record<string, Tone> = {
  RESOLVED: "green",
  OWNED: "amber",
  ACCEPTED: "blue",
  MITIGATED: "green",
  UNCLASSIFIED: "neutral",
};

function riskSeverityTone(severity: number): Tone {
  if (severity >= 5) {
    return "red";
  }
  if (severity >= 4) {
    return "amber";
  }
  if (severity >= 3) {
    return "blue";
  }
  return "green";
}

function RiskSnapshotRow({ risk }: { risk: RiskView }) {
  const tone = riskSeverityTone(risk.severity);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span
        className="mono"
        style={{
          display: "grid",
          placeItems: "center",
          width: 26,
          height: 26,
          borderRadius: 7,
          background: `var(--${tone})`,
          color: "var(--on-solid)",
          fontSize: 12,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {risk.severity}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.3,
          }}
        >
          {risk.title}
        </div>
        <div
          style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}
        >
          {risk.category}
        </div>
      </div>
      <Badge dot tone={RISK_ROAM_TONE[risk.roamStatus] ?? "neutral"}>
        {risk.roamStatus}
      </Badge>
    </div>
  );
}

function ExecutiveBody() {
  const [state, setState] = useState<SnapshotState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      getExecutiveDashboard(),
      listOkrs(),
      listRisks(),
      listLeanBudgets(),
    ]).then(([dashboardRes, okrsRes, risksRes, budgetsRes]) => {
      if (!(dashboardRes.ok && okrsRes.ok && risksRes.ok && budgetsRes.ok)) {
        setError(true);
        setLoading(false);
        return;
      }
      setState({
        dashboard: dashboardRes.data,
        okrs: okrsRes.data,
        risks: risksRes.data,
        budgets: budgetsRes.data,
      });
      setLastUpdated(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scoreComponents = useMemo(() => computeScoreComponents(state), [state]);
  const portfolioScore =
    scoreComponents.length > 0
      ? Math.round(
          scoreComponents.reduce((s, c) => s + c.value, 0) /
            scoreComponents.length
        )
      : null;

  const okrAvg =
    state.okrs.length > 0
      ? Math.round(
          state.okrs.reduce((s, o) => s + okrProgress(o), 0) / state.okrs.length
        )
      : null;

  const totalBudget = state.budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = state.budgets.reduce((s, b) => s + b.spent, 0);
  const budgetPct =
    state.budgets.length > 0 && totalBudget > 0
      ? Math.round((totalSpent / totalBudget) * 100)
      : null;

  const topRisks = [...state.risks]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 4);

  if (loading) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}
      >
        Carregando snapshot…
      </div>
    );
  }

  if (error || !state.dashboard) {
    return (
      <ErrorState message="Não foi possível carregar o snapshot executivo." />
    );
  }

  const dashboard = state.dashboard;
  const hasArtData = dashboard.artTable.length > 0;
  const hasFlowData = dashboard.kpis.flowSnapshotCount > 0;
  const hasRetroActionData = dashboard.kpis.totalRetroActions > 0;

  return (
    <div className="fade-in" id="executive-print-root">
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow="COSMOS · Portfólio"
        meta={
          <Badge dot pulse tone="green">
            Ao vivo
          </Badge>
        }
        subtitle={`Visão executiva do portfólio, montada a partir dos dados reais do tenant · atualizado às ${lastUpdated || "—"}`}
        title="Board Snapshot"
        tone="accent"
      >
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <Button
            icon="download"
            onClick={() => downloadSnapshotCsv(state)}
            size="md"
            variant="secondary"
          >
            Exportar CSV
          </Button>
          <Button
            icon="fileText"
            onClick={() => window.print()}
            size="md"
            variant="primary"
          >
            Imprimir / PDF
          </Button>
        </div>
      </PageHeader>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        {/* portfolio score + hero KPIs */}
        <div
          style={{
            display: "flex",
            gap: "var(--gap)",
            alignItems: "stretch",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--card-shadow)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexShrink: 0,
            }}
          >
            {portfolioScore === null ? (
              <div style={{ maxWidth: 220 }}>
                <div style={sectionLabelStyle}>Portfolio Score</div>
                <div style={{ fontSize: 13, color: "var(--ink-subtle)" }}>
                  Dados insuficientes para calcular um score do portfólio.
                </div>
              </div>
            ) : (
              <>
                <RingGauge score={portfolioScore} size={120} stroke={10} />
                <div>
                  <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>
                    Portfolio Score
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink-subtle)",
                    }}
                  >
                    {portfolioScore >= 80
                      ? "Portfólio saudável"
                      : portfolioScore >= 60
                        ? "Atenção necessária"
                        : "Intervenção crítica"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Badge
                      dot
                      tone={
                        portfolioScore >= 80
                          ? "green"
                          : portfolioScore >= 60
                            ? "amber"
                            : "red"
                      }
                    >
                      {portfolioScore >= 80
                        ? "Saudável"
                        : portfolioScore >= 60
                          ? "Atenção"
                          : "Crítico"}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>

          <KpiCard
            hint="Média dos key results ativos"
            icon="trending"
            label="Progresso OKR"
            tone="blue"
            unit={okrAvg === null ? undefined : "%"}
            value={okrAvg === null ? "—" : okrAvg}
          />
          <KpiCard
            hint={`Média de ${dashboard.artTable.length} ART(s) ativo(s)`}
            icon="activity"
            label="Predictability"
            tone="green"
            unit={hasArtData ? "%" : undefined}
            value={hasArtData ? dashboard.kpis.predictabilityPct : "—"}
          />
          <KpiCard
            hint={
              budgetPct === null
                ? "sem orçamento registrado"
                : `$${totalSpent.toLocaleString("pt-BR")} de $${totalBudget.toLocaleString("pt-BR")}`
            }
            icon="layers"
            label="Budget Utilizado"
            tone={budgetPct !== null && budgetPct > 90 ? "red" : "amber"}
            unit={budgetPct === null ? undefined : "%"}
            value={budgetPct === null ? "—" : budgetPct}
          />
        </div>

        {/* ART health */}
        <div>
          <div style={sectionLabelStyle}>ARTs · Saúde do portfólio</div>
          {hasArtData ? (
            <div
              style={{ display: "flex", gap: "var(--gap)", flexWrap: "wrap" }}
            >
              {dashboard.artTable.map((art) => (
                <ArtHealthMiniCard art={art} key={art.artId} />
              ))}
            </div>
          ) : (
            <EmptyState
              description="Nenhum ART ativo com dados de PI para exibir saúde."
              icon="building"
              title="Sem dados de ART"
            />
          )}
        </div>

        {/* OKRs | Riscos */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            action={<Badge tone="accent">{state.okrs.length} OKRs</Badge>}
            icon="star"
            title="Objetivos Estratégicos"
          >
            {state.okrs.length === 0 ? (
              <EmptyState
                description="Objetivos do portfólio aparecerão aqui."
                icon="star"
                title="Nenhum OKR registrado"
              />
            ) : (
              state.okrs.map((o) => <OkrSnapshotRow key={o.id} okr={o} />)
            )}
          </SectionCard>

          <SectionCard
            action={<Badge tone="red">Top {topRisks.length}</Badge>}
            icon="alert"
            title="Riscos Críticos"
          >
            {topRisks.length === 0 ? (
              <EmptyState
                description="Nenhum risco crítico registrado."
                icon="shield"
                title="Nenhum risco registrado"
              />
            ) : (
              topRisks.map((r) => <RiskSnapshotRow key={r.id} risk={r} />)
            )}
          </SectionCard>
        </div>

        {/* flow KPI strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            gap: "var(--gap)",
          }}
        >
          <KpiCard
            hint="ARTs com PI ativo"
            icon="target"
            label="Predictability PI"
            tone="accent"
            unit={hasArtData ? "%" : undefined}
            value={hasArtData ? dashboard.kpis.predictabilityPct : "—"}
          />
          <KpiCard
            hint="tempo de valor / ciclo"
            icon="zap"
            label="Flow Efficiency"
            tone="purple"
            unit={hasFlowData ? "%" : undefined}
            value={hasFlowData ? dashboard.kpis.flowEfficiency : "—"}
          />
          <KpiCard
            hint="mediana do portfólio"
            icon="clock"
            label="Cycle Time"
            tone="blue"
            unit={hasFlowData ? "d" : undefined}
            value={hasFlowData ? dashboard.kpis.cycleTimeDays : "—"}
          />
          <KpiCard
            hint="retro action items"
            icon="check"
            label="Ações de Retro Concluídas"
            tone="green"
            unit={hasRetroActionData ? "%" : undefined}
            value={
              hasRetroActionData ? dashboard.kpis.actionCompletionRate : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveScreen() {
  return <ExecutiveBody />;
}
