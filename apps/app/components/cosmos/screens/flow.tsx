"use client";

// flow.tsx — Analytics · Flow Metrics, wired to getLatestFlowMetrics(). Real
// data is a single point-in-time FlowMetricSnapshot (no week-over-week
// history), so this is a KPI summary of the latest snapshot rather than the
// original 8-week CFD/FlowBars/Donut charts.
import {
  type FlowMetricsView,
  getLatestFlowMetrics,
} from "@/app/(cosmos)/actions/flow";
import {
  Badge,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  useAction,
} from "../kit";

export default function FlowScreen() {
  const { data, loading, error } = useAction<FlowMetricsView | null>(
    getLatestFlowMetrics
  );

  return (
    <div className="fade-in">
      <PageHeader
        meta={
          data ? (
            <Badge tone="accent">
              Snapshot de{" "}
              {new Date(data.recordedAt).toLocaleDateString("pt-BR")}
            </Badge>
          ) : undefined
        }
        subtitle="As seis métricas de fluxo SAFe, com base no snapshot mais recente."
        title="Flow Metrics"
      />
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && data === null && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Nenhuma métrica de flow registrada ainda.
        </div>
      )}
      {!(error || loading) && data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <KpiCard
              hint="itens concluídos"
              icon="activity"
              label="Flow Velocity"
              tone="green"
              value={data.flowVelocityTotal}
            />
            <KpiCard
              hint="lead time médio"
              icon="clock"
              label="Flow Time"
              tone="amber"
              unit="d"
              value={(data.flowTimeAvgHours / 24).toFixed(1)}
            />
            <KpiCard
              hint="ativo vs. espera"
              icon="gauge"
              label="Flow Efficiency"
              tone="blue"
              unit="%"
              value={Math.round(data.flowEfficiency * 100)}
            />
            <KpiCard
              hint="itens em curso"
              icon="layers"
              label="Flow Load (WIP)"
              tone="purple"
              value={data.flowLoadCurrent}
            />
            <KpiCard
              hint="entregas dentro do previsto"
              icon="trendingUp"
              label="Flow Predictability"
              tone="green"
              unit="%"
              value={Math.round(data.flowPredictability * 100)}
            />
          </div>
          <SectionCard
            subtitle="Itens por tipo no snapshot mais recente"
            title="Flow Distribution"
          >
            <div style={{ padding: "4px 0" }}>
              {Object.entries(data.flowDistribution).map(([type, count]) => (
                <div
                  key={type}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    borderTop: "1px solid var(--hairline)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--ink-muted)" }}>{type}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
