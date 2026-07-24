"use client";

// flow.tsx — Analytics · Flow Metrics, wired to getLatestFlowMetrics(). Real
// data is a single point-in-time FlowMetricSnapshot (no week-over-week
// history), so this is a KPI summary of the latest snapshot rather than the
// original 8-week CFD/FlowBars/Donut charts.
import {
  AGING_WIP_SLA_DAYS,
  type AgingWipItem,
  type FlowMetricsView,
  getAgingWip,
  getLatestFlowMetrics,
} from "@/app/(cosmos)/actions/flow";
import { EmptyState } from "../empty-state";
import {
  Badge,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useAction,
} from "../kit";

const ENTITY_LABEL: Record<AgingWipItem["entityType"], string> = {
  Story: "História",
  Feature: "Feature",
  Epic: "Épico",
};

function agingTone(item: AgingWipItem): Tone {
  if (item.overSla) {
    return "red";
  }
  if (item.days >= item.slaDays * 0.7) {
    return "amber";
  }
  return "green";
}

function AgingWipPanel() {
  const { data, loading, error } = useAction<AgingWipItem[]>(getAgingWip);
  const items = data ?? [];
  const overSlaCount = items.filter((i) => i.overSla).length;
  const maxDays = Math.max(AGING_WIP_SLA_DAYS * 2, ...items.map((i) => i.days));

  return (
    <SectionCard
      action={
        !(error || loading) &&
        items.length > 0 && (
          <Badge tone={overSlaCount > 0 ? "red" : "green"}>
            {overSlaCount} acima do SLA
          </Badge>
        )
      }
      icon="clock"
      subtitle={`Itens em curso vs. SLA de ${AGING_WIP_SLA_DAYS} dias`}
      title="Aging WIP"
      tone="amber"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && items.length === 0 && (
        <EmptyState
          description="Nenhuma história, feature ou épico está em progresso no momento."
          icon="clock"
          title="Nada em WIP"
        />
      )}
      {!(error || loading) && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((item) => (
            <div key={`${item.entityType}:${item.entityId}`}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                  fontSize: 12.5,
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <Badge soft tone="neutral">
                    {ENTITY_LABEL[item.entityType]}
                  </Badge>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{ fontWeight: 700, flexShrink: 0 }}
                >
                  {item.days}d{" "}
                  {item.overSla && (
                    <span
                      style={{ color: "var(--ink-faint)", fontWeight: 500 }}
                    >
                      (+{item.days - item.slaDays}d sobre SLA)
                    </span>
                  )}
                </span>
              </div>
              <Progress
                tone={agingTone(item)}
                value={Math.min(100, Math.round((item.days / maxDays) * 100))}
              />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

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
      <div style={{ marginTop: 14 }}>
        <AgingWipPanel />
      </div>
    </div>
  );
}
