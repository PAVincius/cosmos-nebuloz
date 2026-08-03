"use client";

// flow.tsx — Analytics · Flow Metrics, wired to getLatestFlowMetrics(). Real
// data is a single point-in-time FlowMetricSnapshot (no week-over-week
// history), so this is a KPI summary of the latest snapshot rather than the
// original 8-week CFD/FlowBars/Donut charts.
import {
  type DoraMetricsView,
  type DoraMetricValue,
  getDoraMetrics,
} from "@/app/(cosmos)/actions/dora";
import {
  type AgingWipItem,
  type FlowMetricsSeriesPoint,
  type FlowMetricsView,
  getAgingWip,
  getFlowMetricsSeries,
  getLatestFlowMetrics,
} from "@/app/(cosmos)/actions/flow";
import { AGING_WIP_SLA_DAYS } from "@/app/(cosmos)/actions/flow.constants";
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

// ── DORA metrics — driven by getDoraMetrics() ──
// Três das quatro têm fonte: deployment frequency, lead time e change failure
// rate saem de GitHubDeploymentEvent. O CFR mostrado aqui é falha de
// *deployment* sobre deployment concluído, que não é a definição canônica do
// DORA (deployment que degradou o serviço) — por isso o denominador aparece ao
// lado do número, para a leitora julgar o tamanho da amostra.
//
// MTTR não tem fonte alguma: não há model Incident nem integração de
// on-call no repo. Fica com o marcador de indisponível e o motivo, nunca com um
// 0 — um "MTTR de 0h" leria como "restauração instantânea", que nada sustenta.

// Limiares DORA de change failure rate (lib/github/dora-metrics.ts): Elite < 5%,
// High < 15%.
const CFR_ELITE_MAX = 0.05;
const CFR_HIGH_MAX = 0.15;

function cfrTone(m: DoraMetricValue): Tone {
  if (m.status !== "measured") {
    return "neutral";
  }
  if (m.value < CFR_ELITE_MAX) {
    return "green";
  }
  if (m.value < CFR_HIGH_MAX) {
    return "amber";
  }
  return "red";
}

function doraKpiValue(m: DoraMetricValue, format: (n: number) => string) {
  return m.status === "measured" ? format(m.value) : "—";
}

function doraKpiHint(m: DoraMetricValue, whenMeasured: string) {
  return m.status === "measured" ? whenMeasured : m.reason;
}

function DoraSection() {
  const { data, loading, error } = useAction<DoraMetricsView>(getDoraMetrics);

  return (
    <SectionCard
      icon="gitBranch"
      subtitle="Últimos 30 dias de deployments de produção. Change failure rate conta deployment que falhou, não incidente em produção — MTTR não tem fonte."
      title="DORA Metrics"
      tone="purple"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && data && !data.hasProductionDeployments && (
        <EmptyState
          description="Nenhum deployment de produção foi registrado nos últimos 30 dias. As métricas aparecem assim que o webhook do GitHub reportar deployments."
          icon="gitBranch"
          title="Sem deployments de produção"
        />
      )}
      {!(error || loading) && data?.hasProductionDeployments && (
        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          <KpiCard
            hint={doraKpiHint(
              data.deploymentFrequency,
              `${data.successfulProductionDeployments} deploy(s) com sucesso em ${data.windowDays}d`
            )}
            icon="gitBranch"
            label="Deployment Frequency"
            tone="green"
            unit="/dia"
            value={doraKpiValue(data.deploymentFrequency, (n) =>
              n.toFixed(2).replace(".", ",")
            )}
          />
          <KpiCard
            hint={doraKpiHint(data.leadTimeHours, "commit → produção")}
            icon="clock"
            label="Lead Time"
            tone="blue"
            unit={data.leadTimeHours.status === "measured" ? "d" : undefined}
            value={doraKpiValue(data.leadTimeHours, (n) =>
              (n / 24).toFixed(1).replace(".", ",")
            )}
          />
          <KpiCard
            hint={doraKpiHint(
              data.changeFailureRate,
              `${data.failedProductionDeployments} de ${data.totalProductionDeployments} deploy(s) de produção concluídos`
            )}
            icon="alert"
            label="Change Failure Rate"
            tone={cfrTone(data.changeFailureRate)}
            unit={
              data.changeFailureRate.status === "measured" ? "%" : undefined
            }
            value={doraKpiValue(data.changeFailureRate, (n) =>
              Math.round(n * 100).toString()
            )}
          />
          <KpiCard
            hint={data.mttrHours.reason}
            icon="alert"
            label="MTTR"
            tone="neutral"
            value="—"
          />
        </div>
      )}
    </SectionCard>
  );
}

// ── Throughput / CFD history — driven by getFlowMetricsSeries() ──

function ThroughputChart({ series }: { series: FlowMetricsSeriesPoint[] }) {
  const max = Math.max(1, ...series.map((s) => s.flowVelocityTotal));
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--ink-muted)",
          marginBottom: 10,
        }}
      >
        Throughput por sprint (SP entregues)
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          height: 120,
        }}
      >
        {series.map((s) => {
          const pct = Math.max(3, (s.flowVelocityTotal / max) * 100);
          return (
            <div
              key={s.periodRef}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ink-muted)",
                }}
              >
                {s.flowVelocityTotal}
              </span>
              <div
                style={{
                  width: "100%",
                  maxWidth: 34,
                  height: `${pct}%`,
                  borderRadius: "6px 6px 2px 2px",
                  background: "var(--green)",
                  boxShadow: "0 0 8px rgba(var(--green-rgb),.4)",
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-faint)",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Cumulative Flow Diagram — running total of flowVelocityTotal (SP
// delivered) across periods. A single "Done" band rather than the classic
// multi-status stacked area: FlowMetricSnapshot doesn't retain a
// per-status WIP time series, only a point-in-time flowLoadCurrent, so a
// true Backlog/WIP/Done stack isn't derivable from real data yet.
function CfdChart({ series }: { series: FlowMetricsSeriesPoint[] }) {
  let running = 0;
  const cumulative = series.map((s) => {
    running += s.flowVelocityTotal;
    return { ...s, cumulative: running };
  });
  const max = Math.max(1, running);
  const w = 520;
  const h = 130;
  const pad = 6;
  const xs = (i: number) =>
    pad + (i / Math.max(1, cumulative.length - 1)) * (w - pad * 2);
  const ys = (v: number) => pad + (1 - v / max) * (h - pad * 2);
  const line = cumulative
    .map((p, i) => `${i ? "L" : "M"}${xs(i)} ${ys(p.cumulative)}`)
    .join(" ");
  const area = `${line} L${xs(cumulative.length - 1)} ${h} L${xs(0)} ${h} Z`;

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--ink-muted)",
          marginBottom: 10,
        }}
      >
        Fluxo cumulativo (CFD) — SP entregues acumulados
      </div>
      <svg
        height={h}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
      >
        <path d={area} fill="rgba(var(--blue-rgb),.18)" />
        <path
          d={line}
          fill="none"
          stroke="var(--blue)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
          {cumulative[0]?.label}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
          {cumulative.at(-1)?.label}
        </span>
      </div>
    </div>
  );
}

function FlowHistorySection() {
  const { data, loading, error } =
    useAction<FlowMetricsSeriesPoint[]>(getFlowMetricsSeries);
  const series = data ?? [];

  return (
    <SectionCard
      icon="barChart"
      subtitle="Throughput e fluxo cumulativo das sprints fechadas"
      title="Histórico de Flow"
      tone="blue"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && series.length === 0 && (
        <EmptyState
          description="O histórico é criado automaticamente a cada fechamento de sprint. Feche uma sprint para começar a acumular CFD e throughput."
          icon="barChart"
          title="Sem histórico de flow ainda"
        />
      )}
      {!(error || loading) && series.length > 0 && (
        <div
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <ThroughputChart series={series} />
          <CfdChart series={series} />
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
              value={(data.flowTimeAvgHours / 24).toFixed(1).replace(".", ",")}
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
        <FlowHistorySection />
      </div>
      <div style={{ marginTop: 14 }}>
        <AgingWipPanel />
      </div>
      <div style={{ marginTop: 14 }}>
        <DoraSection />
      </div>
    </div>
  );
}
