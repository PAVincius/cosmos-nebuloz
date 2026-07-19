"use client";

// dashboard.tsx — Visão Geral (portfolio executive summary), ported from the
// cosmos handoff. KPI row, velocity area chart, predictability bars, theme
// allocation bars, and in-flight epics list.
import { useId, useState } from "react";
import { ARTS, EPICS } from "@/lib/cosmos-data";
import {
  Badge,
  Button,
  ChartTip,
  CopilotInsightBar,
  CopyId,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "../kit";

// ── AreaChart ──
function AreaChart({
  data,
  tone = "accent",
  height = 132,
  labels,
}: {
  data: number[];
  tone?: string;
  height?: number;
  labels?: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();
  const w = 520,
    h = height,
    pad = 6;
  const max = Math.max(...data),
    min = Math.min(...data);
  const xs = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const ys = (v: number) =>
    pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
  const line = data
    .map((v, i) => `${i ? "L" : "M"}${xs(i)} ${ys(v)}`)
    .join(" ");
  const area = `${line} L${xs(data.length - 1)} ${h} L${xs(0)} ${h} Z`;
  return (
    <div style={{ position: "relative" }}>
      <svg
        height={h}
        preserveAspectRatio="none"
        style={{ overflow: "visible", display: "block" }}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={`var(--${tone})`} stopOpacity="0.32" />
            <stop offset="1" stopColor={`var(--${tone})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        {hover !== null && (
          <line
            stroke="var(--ink-faint)"
            strokeDasharray="3 3"
            strokeWidth="1"
            x1={xs(hover)}
            x2={xs(hover)}
            y1={0}
            y2={h}
          />
        )}
        <path
          d={line}
          fill="none"
          stroke={`var(--${tone})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          style={{
            filter: `drop-shadow(0 4px 8px rgba(var(--${tone}-rgb),.4))`,
          }}
        />
        {data.map((v, i) => (
          <g key={i}>
            <circle
              className="chart-hit"
              cx={xs(i)}
              cy={ys(v)}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              r="12"
            />
            <circle
              cx={xs(i)}
              cy={ys(v)}
              fill="var(--surface)"
              r={hover === i ? 5.5 : i === data.length - 1 ? 4 : 2.6}
              stroke={`var(--${tone})`}
              strokeWidth={hover === i ? 2.8 : 2.2}
              style={{
                transition: "r .15s ease",
                pointerEvents: "none",
                filter:
                  hover === i ? `drop-shadow(0 0 6px var(--${tone}))` : "none",
              }}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <ChartTip
          left={(xs(hover) / w) * 100}
          top={(ys(data[hover]) / h) * 100}
        >
          <b>{labels ? labels[hover] : `#${hover + 1}`}</b> ·{" "}
          <span className="mono">{data[hover]} SP</span>
        </ChartTip>
      )}
    </div>
  );
}

// ── VBars — vertical bar chart ──
function VBars({ data }: { data: { label: string; v: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.v), 100);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        height: 150,
        paddingTop: 8,
      }}
    >
      {data.map((d, i) => {
        const pct = (d.v / max) * 100;
        const good = d.v >= 80;
        const tone = good ? "green" : d.v >= 60 ? "amber" : "red";
        return (
          <div
            className="chart-hit"
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
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
            <div
              style={{
                width: "100%",
                maxWidth: 34,
                height: `${pct}%`,
                borderRadius: "6px 6px 2px 2px",
                background: `var(--${tone})`,
                boxShadow:
                  hover === i
                    ? `0 0 14px rgba(var(--${tone}-rgb),.55)`
                    : `0 0 8px rgba(var(--${tone}-rgb),.4)`,
                transition:
                  "height .6s cubic-bezier(.2,.8,.3,1), box-shadow .15s ease",
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink-muted)",
              }}
            >
              {d.v}%
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--ink-faint)",
                fontWeight: 600,
              }}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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

export default function DashboardScreen() {
  const { navigate } = useNav();
  const inProgress = EPICS.filter((e) => e.col === "implementing");

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
        <Button
          icon="sparkles"
          onClick={() => navigate("copilot")}
          variant="primary"
        >
          Perguntar ao ORBIT
        </Button>
      </PageHeader>

      <CopilotInsightBar onAction={() => navigate("anomalies")}>
        <strong style={{ color: "var(--accent-text)", fontWeight: 700 }}>
          ORBIT
        </strong>{" "}
        · custo de nuvem subiu 12% no mês com 2 anomalias abertas — revise os
        guardrails de FinOps antes do próximo checkpoint.
      </CopilotInsightBar>

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
            <Button
              iconRight="arrowRight"
              onClick={() => navigate("kanban")}
              size="sm"
              variant="ghost"
            >
              Ver Kanban
            </Button>
          }
          icon="layers"
          subtitle={`${inProgress.length} em execução`}
          title="Épicos em Implementação"
          tone="blue"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {inProgress.map((e) => {
              const art = ARTS[e.art];
              return (
                <div
                  className="chart-hit"
                  key={e.id}
                  onClick={() => navigate("epic", e.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <CopyId value={e.id}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: `var(--${art.tone}-text)`,
                        background: `rgba(var(--${art.tone}-rgb),.14)`,
                        border: `1px solid rgba(var(--${art.tone}-rgb),.28)`,
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
                      <Progress height={5} tone={art.tone} value={e.progress} />
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
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
