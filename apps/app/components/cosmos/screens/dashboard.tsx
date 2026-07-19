// dashboard.tsx — Visão Geral (portfolio executive summary), ported from the
// cosmos handoff. KPI row, velocity area chart, predictability bars, theme
// allocation bars, and in-flight epics list.
import { listEpics } from "@/app/(cosmos)/actions/kanban";
import { ARTS } from "@/lib/cosmos-data";
import {
  Badge,
  Button,
  CopyId,
  KpiCard,
  NavButton,
  PageHeader,
  Progress,
  SectionCard,
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

const velocity = [128, 141, 134, 150, 156, 162];
const velocityLabels = ["PI-21", "PI-22", "PI-23", "PI-24", "PI-25", "PI-26"];
const predict = [
  { label: "PI-22", v: 78 },
  { label: "PI-23", v: 85 },
  { label: "PI-24", v: 81 },
  { label: "PI-25", v: 88 },
  { label: "PI-26", v: 87 },
];
const themeAlloc = [
  { label: "Modernização da Plataforma", v: 1240, tone: "accent" },
  { label: "Expansão LATAM", v: 980, tone: "blue" },
  { label: "Confiança & Risco", v: 720, tone: "purple" },
  { label: "Data & AI", v: 610, tone: "green" },
  { label: "Eficiência de Custo", v: 340, tone: "amber" },
];

export default async function DashboardScreen(_props?: { param?: string }) {
  const epicsResult = await listEpics();
  const epics = epicsResult.ok ? epicsResult.data : [];
  const inProgress = epics.filter((e) => e.column === "implementing");

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Resumo executivo"
        meta={
          <>
            <Badge dot pulse tone="green">
              PI-26 · Sprint 3
            </Badge>
            <Badge tone="neutral">4 ARTs ativos</Badge>
          </>
        }
        subtitle="Saúde do portfólio SAFe em um olhar — predictability, throughput, custo e épicos em execução ao longo dos ARTs."
        title="Visão Geral"
      >
        <Button icon="download" variant="secondary">
          Exportar
        </Button>
        <OrbitButton />
      </PageHeader>

      <AnomaliesCopilotBar>
        <strong style={{ color: "var(--accent-text)", fontWeight: 700 }}>
          ORBIT
        </strong>{" "}
        · custo de nuvem subiu 12% no mês com 2 anomalias abertas — revise os
        guardrails de FinOps antes do próximo checkpoint.
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
          delta="+6 pts"
          deltaTone="green"
          hint="vs. PI-25"
          icon="target"
          label="PI Predictability"
          tone="green"
          unit="%"
          value="87"
        />
        <KpiCard
          hint="4 ARTs"
          icon="layers"
          label="Épicos em progresso"
          tone="accent"
          value={String(inProgress.length)}
        />
        <KpiCard
          delta="+8%"
          deltaTone="green"
          hint="média 6 sprints"
          icon="activity"
          label="Throughput semanal"
          tone="blue"
          unit="SP"
          value="34"
        />
        <KpiCard
          delta="+12%"
          deltaTone="amber"
          hint="2 anomalias"
          icon="dollar"
          label="Custo de nuvem · MTD"
          tone="amber"
          unit="k"
          value="48,2"
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
          subtitle="Story points entregues por PI"
          title="Velocity do Programa"
          tone="accent"
        >
          <AreaChart data={velocity} labels={velocityLabels} tone="accent" />
        </SectionCard>
        <SectionCard
          bodyStyle={{ overflow: "visible" }}
          icon="target"
          subtitle="Objetivos committed entregues"
          title="Predictability por PI"
          tone="green"
        >
          <VBars data={predict} />
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
          <HBars rows={themeAlloc} />
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
